"""
Execution REST + WebSocket endpoints.

REST:
  POST   /executions                        — start a graph execution
  GET    /executions/{run_id}               — poll execution status
  POST   /executions/{run_id}/cancel        — cancel a running execution
  POST   /executions/{run_id}/approve       — resolve an ApprovalStep gate
  POST   /executions/{run_id}/documents     — ingest RAG documents for a graph

WebSocket:
  WS     /executions/ws/{run_id}?token=JWT  — stream execution events
"""
from __future__ import annotations

import asyncio
import json
from typing import Any
from uuid import uuid4
from datetime import datetime

import redis.asyncio as aioredis
import structlog
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)

from app.core.auth import AuthUser, get_current_user, verify_token
from app.core.config import settings
from app.core.monitoring import decrement_ws, increment_ws
from app.models.execution import (
    ApproveStepRequest,
    ExecutionRunResponse,
    ExecutionStatus,
    StartExecutionRequest,
    StartExecutionResponse,
)
from app.services.checkpoint import decrypt_state
from app.services.execution import execute_graph, resolve_approval
from app.services.nodes.wait_callback import consume_resume_token
from app.services.supabase import get_supabase_admin_client
from app.services.user_keys import get_keys_for_user
from app.workers.execution_workflow import start_workflow

router = APIRouter()
log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=StartExecutionResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_execution(
    body: StartExecutionRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(get_current_user),
) -> StartExecutionResponse:
    supabase = get_supabase_admin_client()

    # Load graph and verify ownership
    graph_resp = (
        supabase.table("graphs")
        .select("id, content, user_id")
        .eq("id", body.graph_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not graph_resp.data:
        raise HTTPException(status_code=404, detail="Graph not found")

    graph_content: dict[str, Any] = graph_resp.data["content"]
    if not graph_content.get("nodes"):
        raise HTTPException(status_code=422, detail="Graph has no nodes")

    run_id = str(uuid4())
    supabase.table("graph_runs").insert(
        {
            "id": run_id,
            "user_id": current_user.id,
            "graph_id": body.graph_id,
            "status": ExecutionStatus.PENDING.value,
            "input": body.input_data,
            "started_at": datetime.utcnow().isoformat(),
        }
    ).execute()

    # Merge server-stored keys with request secrets (request overrides stored)
    stored = get_keys_for_user(current_user.id)
    merged_secrets: dict[str, str] = {**stored}
    if body.secrets:
        for k, v in body.secrets.items():
            if v and str(v).strip():
                merged_secrets[k] = str(v).strip()

    background_tasks.add_task(
        start_workflow,
        run_id=run_id,
        user_id=current_user.id,
        graph_id=body.graph_id,
        graph_content=graph_content,
        input_data=body.input_data,
        secrets=merged_secrets,
        temporal_host=settings.TEMPORAL_HOST,
    )

    log.info("execution_started", run_id=run_id, graph_id=body.graph_id, user=current_user.id)
    return StartExecutionResponse(run_id=run_id, status=ExecutionStatus.PENDING)


@router.get("/", response_model=dict[str, Any])
async def list_executions(
    graph_id: str | None = Query(default=None, description="Filter by graph ID"),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """List executions for the current user, optionally filtered by graph_id."""
    supabase = get_supabase_admin_client()
    q = (
        supabase.table("graph_runs")
        .select("id, graph_id, status, started_at, completed_at")
        .eq("user_id", current_user.id)
        .order("started_at", desc=True)
        .limit(limit)
    )
    if graph_id:
        q = q.eq("graph_id", graph_id)
    resp = q.execute()
    rows = resp.data or []
    return {"runs": rows}


@router.get("/{run_id}", response_model=ExecutionRunResponse)
async def get_execution(
    run_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> ExecutionRunResponse:
    supabase = get_supabase_admin_client()
    resp = (
        supabase.table("graph_runs")
        .select("*")
        .eq("id", run_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Execution not found")
    row = resp.data
    return ExecutionRunResponse(
        id=row["id"],
        graph_id=row["graph_id"],
        user_id=row["user_id"],
        status=ExecutionStatus(row["status"]),
        input=row.get("input"),
        output=row.get("output"),
        error=row.get("error"),
        started_at=row["started_at"],
        completed_at=row.get("completed_at"),
    )


@router.post("/resume", response_model=StartExecutionResponse, status_code=status.HTTP_202_ACCEPTED)
async def resume_execution(
    background_tasks: BackgroundTasks,
    token: str = Query(..., description="Resume token from Wait for Callback node"),
    body: dict[str, Any] | None = None,
) -> StartExecutionResponse:
    """Resume a paused run (Wait for Callback). Token is consumed; callback body merged into state."""
    redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        pair = await consume_resume_token(redis, token)
        if not pair:
            raise HTTPException(status_code=400, detail="Invalid or expired resume token")
        run_id, wait_node_id = pair
    finally:
        await redis.aclose()

    supabase = get_supabase_admin_client()
    run_resp = (
        supabase.table("graph_runs")
        .select("id, user_id, graph_id, status")
        .eq("id", run_id)
        .maybe_single()
        .execute()
    )
    if not run_resp.data:
        raise HTTPException(status_code=404, detail="Run not found")
    if run_resp.data["status"] != ExecutionStatus.PAUSED.value:
        raise HTTPException(status_code=409, detail="Run is not paused")

    ckpt_resp = (
        supabase.table("checkpoints")
        .select("state")
        .eq("run_id", run_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not ckpt_resp.data or not ckpt_resp.data[0].get("state", {}).get("encrypted"):
        raise HTTPException(status_code=404, detail="No checkpoint found for this run")

    try:
        state = decrypt_state(ckpt_resp.data[0]["state"]["encrypted"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Checkpoint invalid: {e}") from e

    merged_input = {**(state.get("_input") or {}), **(body or {})}
    node_outputs = state.get("_node_outputs") or {}
    user_id = run_resp.data["user_id"]
    graph_id = run_resp.data["graph_id"]

    graph_resp = (
        supabase.table("graphs")
        .select("content")
        .eq("id", graph_id)
        .maybe_single()
        .execute()
    )
    if not graph_resp.data:
        raise HTTPException(status_code=404, detail="Graph not found")
    graph_content = graph_resp.data["content"] or {}
    secrets = get_keys_for_user(user_id)

    background_tasks.add_task(
        execute_graph,
        run_id=run_id,
        user_id=user_id,
        graph_id=graph_id,
        graph_content=graph_content,
        input_data=merged_input,
        secrets=secrets,
        start_after_node_id=wait_node_id,
        initial_node_outputs=node_outputs,
    )
    log.info("execution_resumed", run_id=run_id)
    return StartExecutionResponse(run_id=run_id, status=ExecutionStatus.RUNNING)


@router.post("/{run_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_execution(
    run_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> None:
    supabase = get_supabase_admin_client()
    resp = (
        supabase.table("graph_runs")
        .select("id, status")
        .eq("id", run_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Execution not found")
    if resp.data["status"] not in (ExecutionStatus.PENDING, ExecutionStatus.RUNNING):
        raise HTTPException(status_code=409, detail="Execution is not active")

    supabase.table("graph_runs").update({"status": ExecutionStatus.CANCELLED.value}).eq(
        "id", run_id
    ).execute()


@router.post("/{run_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
async def approve_step(
    run_id: str,
    body: ApproveStepRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> None:
    supabase = get_supabase_admin_client()
    resp = (
        supabase.table("graph_runs")
        .select("id, user_id")
        .eq("id", run_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Execution not found")

    ok = resolve_approval(run_id, approved=body.approved, feedback=body.feedback)
    if not ok:
        raise HTTPException(status_code=409, detail="No pending approval gate for this execution")


def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    chunks: list[str] = []
    step = chunk_size - overlap
    for start in range(0, len(text), step):
        chunk = text[start : start + chunk_size]
        if chunk.strip():
            chunks.append(chunk)
    return chunks


# RAG data flow: (1) Ingest: files → chunk text / placeholder for images → embed via LiteLLM → store in documents (pgvector).
# (2) Retrieval: query → embed → match_documents RPC → ranked documents. (3) LLM: RAG node output → state → LLM node receives "Retrieved context to summarize".
@router.post("/{graph_id}/documents", status_code=status.HTTP_200_OK)
async def ingest_documents(
    graph_id: str,
    file: UploadFile | None = File(default=None),
    files: list[UploadFile] | None = File(default=None),
    collection_id: str = Query(...),
    chunk_size: int = Query(default=512, ge=64, le=2048),
    overlap: int = Query(default=50, ge=0, le=256),
    openai_api_key: str | None = Form(default=None, description="OpenAI API key for embeddings (optional, from Run settings)"),
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Upload one or more text/image files and ingest as RAG document chunks. Supports multiple files in one request."""
    from app.services.rag_retriever import ingest_document_chunks

    # Normalize to list: single file or multiple files
    uploads: list[UploadFile] = []
    if file:
        uploads.append(file)
    if files:
        uploads.extend(files)
    if not uploads:
        return {"status": "no_files", "collection_id": collection_id, "chunks_ingested": 0, "files": []}

    api_key = (openai_api_key or "").strip() or None
    if not api_key:
        stored = get_keys_for_user(current_user.id)
        api_key = stored.get("OPENAI_API_KEY")
    if not api_key and settings.OPENAI_API_KEY:
        api_key = settings.OPENAI_API_KEY
    secrets = {"OPENAI_API_KEY": api_key} if api_key else None

    total_chunks = 0
    file_results: list[dict[str, Any]] = []

    for f in uploads:
        content_bytes = await f.read()
        filename = f.filename or "unknown"
        content_type = (f.content_type or "").lower()

        # Image: store as single placeholder chunk until vision/OCR is added
        if content_type.startswith("image/"):
            chunks = [f"[Image: {filename}]"]
            meta = {"filename": filename, "graph_id": graph_id, "type": "image"}
        else:
            text = content_bytes.decode("utf-8", errors="replace")
            chunks = _chunk_text(text, chunk_size, overlap)
            meta = {"filename": filename, "graph_id": graph_id}

        if not chunks:
            file_results.append({"filename": filename, "chunks_ingested": 0, "skipped": "no_content"})
            continue

        count = await ingest_document_chunks(
            user_id=current_user.id,
            collection_id=collection_id,
            chunks=chunks,
            metadata=meta,
            api_key=api_key,
            secrets=secrets,
        )
        total_chunks += count
        file_results.append({"filename": filename, "chunks_ingested": count})

    return {
        "status": "ingested",
        "collection_id": collection_id,
        "chunks_ingested": total_chunks,
        "files": file_results,
    }


# ---------------------------------------------------------------------------
# WebSocket streaming endpoint
# ---------------------------------------------------------------------------


@router.websocket("/ws/{run_id}")
async def execution_ws(
    websocket: WebSocket,
    run_id: str,
    token: str = Query(...),
) -> None:
    """
    WebSocket endpoint for streaming execution events.
    Authenticate via ?token=<JWT> query param.
    Subscribes to Redis channel run:{run_id} and forwards messages.
    """
    # Authenticate before accepting
    try:
        _user = await verify_token(token)
    except Exception:
        await websocket.close(code=4001)
        return

    # Authorize execution ownership before allowing stream subscription.
    supabase = get_supabase_admin_client()
    run_resp = (
        supabase.table("graph_runs")
        .select("id")
        .eq("id", run_id)
        .eq("user_id", _user.id)
        .maybe_single()
        .execute()
    )
    if not run_resp.data:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    increment_ws()
    log.info("ws_connected", run_id=run_id, user=_user.id)

    redis: aioredis.Redis | None = None
    pubsub = None

    try:
        redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"run:{run_id}")

        # Replay last checkpoint so reconnecting clients catch up
        ckpt_resp = (
            supabase.table("checkpoints")
            .select("node_id, created_at")
            .eq("run_id", run_id)
            .order("created_at")
            .execute()
        )
        if ckpt_resp.data:
            await websocket.send_json(
                {
                    "event_type": "replay",
                    "run_id": run_id,
                    "checkpoints": [
                        {"node_id": r["node_id"], "saved_at": r["created_at"]}
                        for r in ckpt_resp.data
                    ],
                }
            )

        async def _listen() -> None:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    await websocket.send_text(data)
                    # Close WS after terminal events
                    parsed = json.loads(data)
                    if parsed.get("event_type") in (
                        "execution_completed",
                        "execution_failed",
                    ):
                        return

        await asyncio.wait_for(_listen(), timeout=1800)  # 30 min hard cap

    except WebSocketDisconnect:
        log.info("ws_disconnected", run_id=run_id)
    except asyncio.TimeoutError:
        await websocket.close(code=4008)
    except Exception as exc:
        log.error("ws_error", run_id=run_id, error=str(exc))
        await websocket.close(code=4000)
    finally:
        decrement_ws()
        if pubsub:
            await pubsub.unsubscribe(f"run:{run_id}")
            await pubsub.aclose()
        if redis:
            await redis.aclose()
