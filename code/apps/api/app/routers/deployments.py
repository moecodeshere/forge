"""
Deployment endpoints.
POST /deployments           — start a deployment
GET  /deployments/{id}      — get deployment status
GET  /deployments/{id}/download — download code export (signed URL redirect)
"""
from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.core.auth import AuthUser, get_current_user
from app.services.deploy.orchestrator import deploy_graph
from app.services.supabase import get_supabase_admin_client

router = APIRouter()
log = structlog.get_logger(__name__)

VALID_TYPES = {"cloud", "mcp", "code", "docker"}


class DeployRequest(BaseModel):
    graph_id: str
    deploy_type: str
    expose_as_mcp: bool = False

    @field_validator("deploy_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_TYPES:
            raise ValueError(f"deploy_type must be one of {VALID_TYPES}")
        return v


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_deployment(
    body: DeployRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    supabase = get_supabase_admin_client()
    graph_resp = (
        supabase.table("graphs")
        .select("id, title, content")
        .eq("id", body.graph_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not graph_resp.data:
        raise HTTPException(status_code=404, detail="Graph not found")

    graph = graph_resp.data
    result = await deploy_graph(
        graph_id=graph["id"],
        graph_content=graph["content"],
        graph_name=graph.get("title", "Untitled"),
        deploy_type=body.deploy_type,
        user_id=current_user.id,
        expose_as_mcp=body.expose_as_mcp,
    )
    return result


@router.get("/{deployment_id}")
async def get_deployment(
    deployment_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    supabase = get_supabase_admin_client()
    resp = (
        supabase.table("deployments")
        .select("*")
        .eq("id", deployment_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return resp.data
