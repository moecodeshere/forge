"""
Vercel cloud deployment service.
Bundles the graph as a serverless function, deploys via Vercel API,
polls build status with 20 s limit and circuit-breaker at 30 s.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

POLL_INTERVAL = 2.0
POLL_TIMEOUT = 20.0
CIRCUIT_BREAKER_TIMEOUT = 30.0
VERCEL_API = "https://api.vercel.com"


def _make_serverless_bundle(graph_content: dict[str, Any], graph_name: str) -> dict[str, Any]:
    """Generate Vercel deployment payload from graph content.
    Uses Vercel Python runtime: handler class inheriting BaseHTTPRequestHandler.
    """
    graph_json = json.dumps(graph_content)
    handler_code = f'''
from http.server import BaseHTTPRequestHandler
import json

GRAPH = {graph_json}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        body = json.dumps({{"graph_nodes": len(GRAPH.get("nodes", [])), "status": "ok"}})
        self.wfile.write(body.encode("utf-8"))

    def do_POST(self):
        self.do_GET()
'''
    return {
        "name": graph_name.lower().replace(" ", "-"),
        "files": [
            {
                "file": "api/index.py",
                "data": handler_code,
            },
            {
                "file": "vercel.json",
                "data": json.dumps(
                    {
                        "rewrites": [{"source": "/(.*)", "destination": "/api/index"}],
                        "functions": {"api/index.py": {"runtime": "python3.12"}},
                    }
                ),
            },
        ],
        "projectSettings": {"framework": None},
    }


async def deploy_to_vercel(
    graph_content: dict[str, Any],
    graph_name: str,
) -> dict[str, str]:
    """
    Deploy graph as Vercel serverless function.
    Returns {"deployment_url": ..., "deployment_id": ...}.
    """
    if not settings.VERCEL_API_TOKEN:
        raise RuntimeError("VERCEL_API_TOKEN not configured")

    headers = {
        "Authorization": f"Bearer {settings.VERCEL_API_TOKEN}",
        "Content-Type": "application/json",
    }
    params: dict[str, str] = {}
    if settings.VERCEL_TEAM_ID:
        params["teamId"] = settings.VERCEL_TEAM_ID

    payload = _make_serverless_bundle(graph_content, graph_name)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{VERCEL_API}/v13/deployments",
            headers=headers,
            params=params,
            json=payload,
        )
        resp.raise_for_status()
        deploy_data = resp.json()

    deployment_id: str = deploy_data["id"]
    log.info("vercel_deploy_created", deployment_id=deployment_id)

    # Poll for readiness
    start = time.monotonic()
    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            elapsed = time.monotonic() - start
            if elapsed > CIRCUIT_BREAKER_TIMEOUT:
                raise RuntimeError(f"Vercel deployment {deployment_id} timed out at 30s")

            status_resp = await client.get(
                f"{VERCEL_API}/v13/deployments/{deployment_id}",
                headers=headers,
                params=params,
            )
            status_resp.raise_for_status()
            status_data = status_resp.json()
            state = status_data.get("status", "")
            log.debug("vercel_poll", deployment_id=deployment_id, state=state)

            if state == "READY":
                url = f"https://{status_data['url']}"
                # Health check: GET the deployment URL; fail if non-2xx
                try:
                    health_resp = await client.get(url)
                    if health_resp.status_code >= 400:
                        raise RuntimeError(
                            f"Health check failed: GET {url} returned {health_resp.status_code}"
                        )
                except RuntimeError:
                    raise
                except Exception as exc:
                    raise RuntimeError(f"Health check failed: {exc}") from exc
                log.info("vercel_deploy_ready", url=url)
                return {"deployment_url": url, "deployment_id": deployment_id}

            if state in ("ERROR", "CANCELED"):
                raise RuntimeError(f"Vercel deployment failed with state: {state}")

            if elapsed > POLL_TIMEOUT:
                raise RuntimeError(f"Vercel deployment not ready after {POLL_TIMEOUT}s")

            await asyncio.sleep(POLL_INTERVAL)
