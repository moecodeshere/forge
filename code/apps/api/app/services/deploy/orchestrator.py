"""
Deployment orchestrator.
Routes to the correct deploy service, writes a Deployment row,
and handles rollback on failure.
"""
from __future__ import annotations

import base64
import io
import zipfile
from datetime import datetime
from typing import Any
from uuid import uuid4

import structlog

from app.services.supabase import get_supabase_admin_client

log = structlog.get_logger(__name__)

# When storage bucket is missing, return ZIP inline if under this size (bytes)
_MAX_INLINE_ZIP_BYTES = 15 * 1024 * 1024  # 15 MB


async def deploy_graph(
    *,
    graph_id: str,
    graph_content: dict[str, Any],
    graph_name: str,
    deploy_type: str,  # "cloud" | "mcp" | "code" | "docker"
    user_id: str,
    expose_as_mcp: bool = False,
) -> dict[str, Any]:
    """
    Orchestrate a graph deployment.
    Returns metadata dict with deployment_url / download_url as applicable.
    Writes a deployments row; rolls back on failure.
    """
    deployment_id = str(uuid4())
    supabase = get_supabase_admin_client()

    supabase.table("deployments").insert(
        {
            "id": deployment_id,
            "graph_id": graph_id,
            "user_id": user_id,
            "type": deploy_type,
            "status": "deploying",
            "created_at": datetime.utcnow().isoformat(),
        }
    ).execute()

    try:
        result = await _route(
            deploy_type=deploy_type,
            graph_content=graph_content,
            graph_name=graph_name,
            graph_id=graph_id,
            expose_as_mcp=expose_as_mcp,
        )
        # Only after a successful deploy: stop prior active rows so one live deployment remains.
        # If _route() raises, previous "active" deployments stay active (implicit rollback).
        supabase.table("deployments").update({"status": "stopped"}).eq("graph_id", graph_id).eq(
            "user_id", user_id
        ).eq("type", deploy_type).eq("status", "active").execute()
        merged_meta = {**result, "replaced_prior_active": True}
        supabase.table("deployments").update(
            {
                "status": "active",
                "metadata": merged_meta,
                "deployed_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", deployment_id).execute()
        log.info("deploy_success", deployment_id=deployment_id, type=deploy_type)
        return {"deployment_id": deployment_id, **result}

    except Exception as exc:
        log.error("deploy_failed", deployment_id=deployment_id, error=str(exc))
        supabase.table("deployments").update(
            {"status": "failed", "error": str(exc)}
        ).eq("id", deployment_id).execute()
        raise


async def _route(
    *,
    deploy_type: str,
    graph_content: dict[str, Any],
    graph_name: str,
    graph_id: str,
    expose_as_mcp: bool = False,
) -> dict[str, Any]:
    if deploy_type == "cloud":
        from app.services.deploy.cloud import deploy_to_vercel
        from app.services.deploy.mcp_deploy import generate_manifest

        result = await deploy_to_vercel(graph_content, graph_name)
        if expose_as_mcp:
            manifest = generate_manifest(graph_content, graph_id, graph_name)
            mcp_url = manifest.get("api", {}).get("url", "")
            result["manifest"] = manifest
            result["mcp_url"] = mcp_url
        return result

    if deploy_type == "mcp":
        from app.services.deploy.mcp_deploy import generate_manifest
        from app.core.config import settings

        manifest = generate_manifest(graph_content, graph_id, graph_name)
        base_url = settings.API_PUBLIC_URL.rstrip("/")
        mcp_url = manifest.get("api", {}).get("url") or f"{base_url}/webhooks/workflow/{graph_id}"
        return {"manifest": manifest, "mcp_url": mcp_url}

    if deploy_type == "code":
        from app.services.deploy.code_export import export_as_zip

        zip_bytes = export_as_zip(graph_content, graph_name)
        path = f"exports/{graph_id}/{graph_name.replace(' ', '_')}.zip"
        filename = path.split("/")[-1]
        supabase = get_supabase_admin_client()
        try:
            supabase.storage.from_("exports").upload(
                path, zip_bytes, file_options={"content-type": "application/zip"}
            )
            signed = supabase.storage.from_("exports").create_signed_url(path, 3600)
            url = signed.get("signedURL") or signed.get("signedUrl", "")
            return {"download_url": url, "path": path}
        except Exception as e:
            if "Bucket not found" in str(e) and len(zip_bytes) <= _MAX_INLINE_ZIP_BYTES:
                b64 = base64.b64encode(zip_bytes).decode("ascii")
                log.info("deploy_code_inline_fallback", reason="bucket_not_found", size=len(zip_bytes))
                return {"download_url": None, "path": path, "download_base64": b64, "filename": filename}
            raise

    if deploy_type == "docker":
        from app.services.deploy.code_export import export_as_zip
        from app.services.deploy.docker_export import (
            generate_docker_compose,
            generate_dockerfile,
            generate_env_example,
        )

        dockerfile = generate_dockerfile(graph_content)
        compose = generate_docker_compose(graph_content, graph_name)
        env_ex = generate_env_example(graph_content)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            code_zip_bytes = export_as_zip(graph_content, graph_name)
            inner = zipfile.ZipFile(io.BytesIO(code_zip_bytes))
            for item in inner.infolist():
                zf.writestr(item, inner.read(item.filename))
            zf.writestr("Dockerfile", dockerfile)
            zf.writestr("docker-compose.yml", compose)
            zf.writestr(".env.example", env_ex)

        zip_bytes = buf.getvalue()
        path = f"exports/{graph_id}/{graph_name.replace(' ', '_')}_docker.zip"
        filename = path.split("/")[-1]
        supabase = get_supabase_admin_client()
        try:
            supabase.storage.from_("exports").upload(
                path, zip_bytes, file_options={"content-type": "application/zip"}
            )
            signed = supabase.storage.from_("exports").create_signed_url(path, 3600)
            url = signed.get("signedURL") or signed.get("signedUrl", "")
            return {"download_url": url, "path": path}
        except Exception as e:
            if "Bucket not found" in str(e) and len(zip_bytes) <= _MAX_INLINE_ZIP_BYTES:
                b64 = base64.b64encode(zip_bytes).decode("ascii")
                log.info("deploy_docker_inline_fallback", reason="bucket_not_found", size=len(zip_bytes))
                return {"download_url": None, "path": path, "download_base64": b64, "filename": filename}
            raise

    raise ValueError(f"Unknown deploy_type: {deploy_type}")
