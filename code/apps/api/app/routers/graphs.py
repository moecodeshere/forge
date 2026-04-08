from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from app.core.auth import AuthUser, get_current_user
from app.services.dag_validator import (
    DAGValidationError,
    validate_graph_is_dag,
    validate_has_single_trigger,
)
from app.services.supabase import get_supabase_admin_client

router = APIRouter()


DEFAULT_GRAPH_CONTENT: dict[str, Any] = {
    "version": 1,
    "nodes": [],
    "edges": [],
    "viewport": {"x": 0, "y": 0, "zoom": 1},
}


def _normalize_db_content(content: Any) -> dict[str, Any]:
    if isinstance(content, dict):
        return content
    return DEFAULT_GRAPH_CONTENT.copy()


def _row_to_graph_response(row: dict[str, Any]) -> GraphResponse:
    payload = dict(row)
    payload["json_content"] = _normalize_db_content(payload.pop("content", None))
    return GraphResponse(**payload)


class GraphCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=512)
    json_content: dict[str, Any] = Field(default_factory=lambda: DEFAULT_GRAPH_CONTENT.copy())


class GraphUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=512)
    json_content: dict[str, Any] | None = None
    is_public: bool | None = None


class GraphResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    user_id: str
    title: str
    description: str | None = None
    json_content: dict[str, Any]
    version: int
    is_public: bool
    created_at: datetime
    updated_at: datetime


class GraphListResponse(BaseModel):
    items: list[GraphResponse]
    total: int


def _validate_content(content: dict[str, Any]) -> None:
    nodes = content.get("nodes") or []
    if not nodes:
        return  # Empty graph is always valid (e.g. "New Graph" before adding nodes)
    try:
        validate_graph_is_dag(content)
        validate_has_single_trigger(content)
    except DAGValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("", response_model=GraphListResponse)
async def list_graphs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AuthUser = Depends(get_current_user),
) -> GraphListResponse:
    client = get_supabase_admin_client()
    result = (
        client.table("graphs")
        .select("*")
        .eq("user_id", current_user.id)
        .order("updated_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = result.data or []
    return GraphListResponse(items=[_row_to_graph_response(row) for row in rows], total=len(rows))


@router.post("", response_model=GraphResponse, status_code=status.HTTP_201_CREATED)
async def create_graph(
    payload: GraphCreateRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> GraphResponse:
    _validate_content(payload.json_content)

    insert_payload = payload.model_dump(exclude={"json_content"})
    insert_payload["content"] = payload.json_content
    insert_payload["user_id"] = current_user.id

    client = get_supabase_admin_client()
    result = client.table("graphs").insert(insert_payload).execute()
    rows = result.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create graph",
        )
    return _row_to_graph_response(rows[0])


@router.get("/{graph_id}", response_model=GraphResponse)
async def get_graph(
    graph_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> GraphResponse:
    client = get_supabase_admin_client()
    result = (
        client.table("graphs")
        .select("*")
        .eq("id", graph_id)
        .eq("user_id", current_user.id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Graph not found")
    return _row_to_graph_response(rows[0])


@router.patch("/{graph_id}", response_model=GraphResponse)
async def update_graph(
    graph_id: str,
    payload: GraphUpdateRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> GraphResponse:
    update_payload = payload.model_dump(exclude_unset=True, exclude={"json_content"})
    if payload.json_content is not None:
        update_payload["content"] = payload.json_content
    if not update_payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    if "content" in update_payload:
        _validate_content(update_payload["content"])

    client = get_supabase_admin_client()
    result = (
        client.table("graphs")
        .update(update_payload)
        .eq("id", graph_id)
        .eq("user_id", current_user.id)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Graph not found")
    return _row_to_graph_response(rows[0])


@router.post("/{graph_id}/mcp/rpc")
async def graph_mcp_rpc(
    graph_id: str,
    body: dict[str, Any],
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """
    MCP JSON-RPC endpoint for graph execution.
    Accepts tools/call and dispatches to the workflow.
    """
    from uuid import uuid4
    from app.models.execution import ExecutionStatus
    from app.services.user_keys import get_keys_for_user
    from app.workers.execution_workflow import start_workflow
    from app.core.config import settings

    client = get_supabase_admin_client()
    graph_resp = (
        client.table("graphs")
        .select("id, content, user_id")
        .eq("id", graph_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not graph_resp.data:
        return {
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "error": {"code": -32602, "message": "Graph not found"},
        }
    graph_content = graph_resp.data.get("content") or {}
    if not graph_content.get("nodes"):
        return {
            "jsonrpc": "2.0",
            "id": body.get("id"),
            "error": {"code": -32602, "message": "Graph has no nodes"},
        }

    params = body.get("params") or {}
    rpc_id = body.get("id")

    input_data: dict[str, Any] = {"query": str(params.get("query", params))}
    if isinstance(params, dict):
        input_data = {**params, **input_data}

    stored = get_keys_for_user(current_user.id)
    merged_secrets: dict[str, str] = dict(stored)

    run_id = str(uuid4())
    client.table("graph_runs").insert(
        {
            "id": run_id,
            "user_id": current_user.id,
            "graph_id": graph_id,
            "status": ExecutionStatus.PENDING.value,
            "input": input_data,
            "started_at": datetime.utcnow().isoformat(),
        }
    ).execute()

    background_tasks.add_task(
        start_workflow,
        run_id=run_id,
        user_id=current_user.id,
        graph_id=graph_id,
        graph_content=graph_content,
        input_data=input_data,
        secrets=merged_secrets,
        temporal_host=settings.TEMPORAL_HOST,
    )
    return {"jsonrpc": "2.0", "id": rpc_id, "result": {"run_id": run_id, "status": "accepted"}}


@router.delete("/{graph_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_graph(
    graph_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> None:
    client = get_supabase_admin_client()
    result = (
        client.table("graphs")
        .delete()
        .eq("id", graph_id)
        .eq("user_id", current_user.id)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Graph not found")
