"""
Graph execution engine.
Compiles Forge graph JSON into an async state machine, executes nodes in
topological order, streams events via Redis pub/sub, and writes AES-256
encrypted checkpoints to Supabase after each node completes.

Retry policy: exponential backoff 1s → 2s → 4s, max 3 attempts.
Node execution is dispatched via the plugin registry.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

import networkx as nx
import redis.asyncio as aioredis
import structlog

from app.core.config import settings
from app.core.monitoring import record_error, record_execution
from app.models.execution import EventType, ExecutionEvent, ExecutionStatus, NodeStatus
from app.services.approval_gates import resolve_approval
from app.services.checkpoint import encrypt_state
from app.services.nodes import get_plugin
from app.services.nodes.base import ExecutionContext
from app.services.supabase import get_supabase_admin_client

log = structlog.get_logger(__name__)

RETRY_DELAYS = [1.0, 2.0, 4.0]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_nx_graph(nodes: list[dict], edges: list[dict]) -> nx.DiGraph:
    g = nx.DiGraph()
    for n in nodes:
        g.add_node(n["id"], **n)
    for e in edges:
        g.add_edge(e["source"], e["target"], id=e.get("id", ""))
    return g


def _topological_order(graph_content: dict) -> list[str]:
    g = _build_nx_graph(graph_content["nodes"], graph_content["edges"])
    return list(nx.topological_sort(g))


def _get_node(graph_content: dict, node_id: str) -> dict:
    for n in graph_content["nodes"]:
        if n["id"] == node_id:
            return n
    raise KeyError(f"Node {node_id} not found")


# ---------------------------------------------------------------------------
# Redis event bus
# ---------------------------------------------------------------------------


async def _get_redis() -> aioredis.Redis:
    return await aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def _publish(redis: aioredis.Redis, event: ExecutionEvent) -> None:
    channel = f"run:{event.run_id}"
    await redis.publish(channel, event.model_dump_json())


# Re-export for backward compatibility (routers import from execution)
__all__ = ["execute_graph", "resolve_approval"]


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------


def _upsert_run(run_id: str, user_id: str, graph_id: str, status: ExecutionStatus) -> None:
    supabase = get_supabase_admin_client()
    supabase.table("graph_runs").upsert(
        {
            "id": run_id,
            "user_id": user_id,
            "graph_id": graph_id,
            "status": status.value,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


def _update_run(
    run_id: str,
    status: ExecutionStatus,
    output: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    supabase = get_supabase_admin_client()
    payload: dict[str, Any] = {"status": status.value}
    if status != ExecutionStatus.PAUSED:
        payload["completed_at"] = datetime.now(timezone.utc).isoformat()
    if output is not None:
        payload["output"] = output
    if error is not None:
        payload["error"] = error
    supabase.table("graph_runs").update(payload).eq("id", run_id).execute()


def _get_run_status(run_id: str) -> str | None:
    supabase = get_supabase_admin_client()
    resp = supabase.table("graph_runs").select("status").eq("id", run_id).maybe_single().execute()
    row = resp.data
    if not row:
        return None
    return str(row.get("status"))


def _write_checkpoint(
    run_id: str,
    node_id: str,
    state: dict[str, Any],
) -> None:
    encrypted = encrypt_state(state)
    supabase = get_supabase_admin_client()
    supabase.table("checkpoints").insert(
        {
            "run_id": run_id,
            "node_id": node_id,
            "state": {"encrypted": encrypted},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


# ---------------------------------------------------------------------------
# Main executor
# ---------------------------------------------------------------------------


async def execute_graph(
    *,
    run_id: str,
    user_id: str,
    graph_id: str,
    graph_content: dict[str, Any],
    input_data: dict[str, Any],
    secrets: dict[str, str] | None = None,
    start_after_node_id: str | None = None,
    initial_node_outputs: dict[str, Any] | None = None,
) -> None:
    """
    Full async graph executor.  Meant to run as a background coroutine.
    Publishes events to Redis channel  run:{run_id}.
    If start_after_node_id and initial_node_outputs are set (resume flow), only runs nodes after that node.
    """
    redis = await _get_redis()
    started = time.perf_counter()
    secrets = secrets or {}

    try:
        _upsert_run(run_id, user_id, graph_id, ExecutionStatus.RUNNING)

        full_order = _topological_order(graph_content)
        if start_after_node_id and initial_node_outputs is not None:
            try:
                idx = full_order.index(start_after_node_id)
                order = full_order[idx + 1 :]
            except ValueError:
                order = full_order
            node_outputs: dict[str, Any] = dict(initial_node_outputs)
        else:
            order = full_order
            node_outputs = {}
        skip_set: set[str] = set()

        for node_id in order:
            current_status = _get_run_status(run_id)
            if current_status == ExecutionStatus.CANCELLED.value:
                await _publish(
                    redis,
                    ExecutionEvent(
                        event_type=EventType.EXECUTION_CANCELLED,
                        run_id=run_id,
                        data={"reason": "Cancelled by user"},
                    ),
                )
                record_execution(
                    graph_id, ExecutionStatus.CANCELLED.value, time.perf_counter() - started
                )
                log.info("execution_cancelled", run_id=run_id)
                return

            if node_id in skip_set:
                await _publish(
                    redis,
                    ExecutionEvent(
                        event_type=EventType.NODE_COMPLETED,
                        run_id=run_id,
                        node_id=node_id,
                        data={"status": NodeStatus.SKIPPED.value},
                    ),
                )
                continue

            node = _get_node(graph_content, node_id)
            node_type: str = node.get("type", "")

            # Build node input: merge global input + direct predecessor outputs
            predecessors = [
                e["source"]
                for e in graph_content["edges"]
                if e["target"] == node_id
            ]
            merged_input: dict[str, Any] = {**input_data}
            for pred_id in predecessors:
                merged_input.update(node_outputs.get(pred_id, {}))

            state_snapshot: dict[str, Any] = {
                "_input": merged_input,
                "_node_outputs": node_outputs,
                "_secrets": secrets,
            }

            await _publish(
                redis,
                ExecutionEvent(
                    event_type=EventType.NODE_STARTED,
                    run_id=run_id,
                    node_id=node_id,
                    data={"node_type": node_type},
                ),
            )

            output: dict[str, Any] = {}
            branch_override: str | None = None
            last_exc: Exception | None = None

            for attempt, delay in enumerate([0.0] + RETRY_DELAYS):
                if _get_run_status(run_id) == ExecutionStatus.CANCELLED.value:
                    await _publish(
                        redis,
                        ExecutionEvent(
                            event_type=EventType.EXECUTION_CANCELLED,
                            run_id=run_id,
                            data={"reason": "Cancelled by user"},
                        ),
                    )
                    record_execution(
                        graph_id, ExecutionStatus.CANCELLED.value, time.perf_counter() - started
                    )
                    log.info("execution_cancelled_during_attempt", run_id=run_id, node_id=node_id)
                    return
                if attempt > 0:
                    await asyncio.sleep(delay)
                try:
                    plugin = get_plugin(node_type)
                    if plugin is None:
                        output = {"warning": f"Unknown node type '{node_type}', skipped"}
                        branch_override = None
                    else:

                        async def _publish_event(evt: ExecutionEvent) -> None:
                            await _publish(redis, evt)

                        ctx = ExecutionContext(
                            run_id=run_id,
                            redis=redis,
                            graph_content=graph_content,
                            publish=_publish_event,
                        )
                        timeout = settings.NODE_EXECUTION_TIMEOUT_SECONDS
                        result = await asyncio.wait_for(
                            plugin.execute(node, state_snapshot, ctx),
                            timeout=timeout,
                        )
                        if isinstance(result, tuple):
                            output, branch_override = result
                        else:
                            output, branch_override = result, None
                    last_exc = None
                    break
                except asyncio.TimeoutError:
                    last_exc = TimeoutError(
                        f"Node execution timed out after {settings.NODE_EXECUTION_TIMEOUT_SECONDS}s"
                    )
                    log.warning(
                        "node_timeout",
                        node_id=node_id,
                        attempt=attempt + 1,
                        timeout_seconds=settings.NODE_EXECUTION_TIMEOUT_SECONDS,
                    )
                except Exception as exc:
                    last_exc = exc
                    log.warning(
                        "node_attempt_failed",
                        node_id=node_id,
                        attempt=attempt + 1,
                        error=str(exc),
                    )

            if last_exc is not None:
                edges_out = [e for e in graph_content.get("edges", []) if e.get("source") == node_id]
                error_target = None
                for e in edges_out:
                    tid = e.get("target")
                    tnode = _get_node(graph_content, tid)
                    if tnode and tnode.get("type") == "error_handler":
                        error_target = tid
                        break
                if error_target is not None:
                    output = {"error": str(last_exc)}
                    branch_override = error_target
                    last_exc = None
                if last_exc is not None:
                    await _publish(
                        redis,
                        ExecutionEvent(
                            event_type=EventType.NODE_FAILED,
                            run_id=run_id,
                            node_id=node_id,
                            data={"error": str(last_exc)},
                        ),
                    )
                    raise last_exc

            node_outputs[node_id] = output

            if output.pop("__pause__", None):
                _update_run(run_id, ExecutionStatus.PAUSED)
                await _publish(
                    redis,
                    ExecutionEvent(
                        event_type=EventType.EXECUTION_COMPLETED,
                        run_id=run_id,
                        data={"status": "paused", "resume_url": output.get("resume_url")},
                    ),
                )
                log.info("execution_paused_for_callback", run_id=run_id, node_id=node_id)
                return

            # Checkpoint after each node (best-effort)
            try:
                _write_checkpoint(run_id, node_id, {**state_snapshot, "_output": output})
                await _publish(
                    redis,
                    ExecutionEvent(
                        event_type=EventType.CHECKPOINT_SAVED,
                        run_id=run_id,
                        node_id=node_id,
                        data={},
                    ),
                )
            except Exception as ckpt_exc:
                log.warning("checkpoint_write_failed", node_id=node_id, error=str(ckpt_exc))

            await _publish(
                redis,
                ExecutionEvent(
                    event_type=EventType.NODE_COMPLETED,
                    run_id=run_id,
                    node_id=node_id,
                    data={"output": output, "status": NodeStatus.SUCCESS.value},
                ),
            )

            # Handle conditional-branch branch skipping
            if branch_override is not None:
                # Mark all nodes NOT in the chosen subtree as skipped
                g = _build_nx_graph(graph_content["nodes"], graph_content["edges"])
                all_descendants = set(nx.descendants(g, node_id))
                chosen_descendants = (
                    set(nx.descendants(g, branch_override)) | {branch_override}
                    if branch_override in g
                    else set()
                )
                skip_set |= all_descendants - chosen_descendants

        final_output = node_outputs.get(order[-1], {}) if order else {}
        _update_run(run_id, ExecutionStatus.COMPLETED, output=final_output)
        record_execution(graph_id, ExecutionStatus.COMPLETED.value, time.perf_counter() - started)
        await _publish(
            redis,
            ExecutionEvent(
                event_type=EventType.EXECUTION_COMPLETED,
                run_id=run_id,
                data={"output": final_output},
            ),
        )
        log.info("execution_completed", run_id=run_id)

    except Exception as exc:
        log.error("execution_failed", run_id=run_id, error=str(exc))
        record_error("execution_failed")
        record_execution(graph_id, ExecutionStatus.FAILED.value, time.perf_counter() - started)
        try:
            _update_run(run_id, ExecutionStatus.FAILED, error=str(exc))
            await _publish(
                redis,
                ExecutionEvent(
                    event_type=EventType.EXECUTION_FAILED,
                    run_id=run_id,
                    data={"error": str(exc)},
                ),
            )
        except Exception:
            pass
    finally:
        await redis.aclose()
