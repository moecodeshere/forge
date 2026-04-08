"""
Temporal workflow definition for durable graph execution.
Temporal is OPTIONAL — set TEMPORAL_HOST in environment to enable.
Without it, the executor runs as a plain asyncio background task.

Requires: temporalio  (pip install temporalio)
Server:   docker run --rm -p 7233:7233 temporalio/auto-setup:latest
"""
from __future__ import annotations

import asyncio
from typing import Any

import structlog

log = structlog.get_logger(__name__)

_TEMPORAL_AVAILABLE = False
try:
    from temporalio import activity, workflow
    from temporalio.client import Client
    from temporalio.worker import Worker

    _TEMPORAL_AVAILABLE = True
except ImportError:
    pass

if _TEMPORAL_AVAILABLE:
    from temporalio import activity, workflow  # type: ignore[assignment]

    @activity.defn
    async def execute_node_activity(params: dict[str, Any]) -> dict[str, Any]:
        """Single-node execution activity (retried by Temporal on failure)."""
        from app.services.execution import execute_graph

        return params  # Full graph execution delegates to execute_graph

    @workflow.defn
    class GraphExecutionWorkflow:
        @workflow.run
        async def run(self, params: dict[str, Any]) -> dict[str, Any]:
            log.info("temporal_workflow_started", run_id=params.get("run_id"))
            result = await workflow.execute_activity(
                execute_node_activity,
                params,
                start_to_close_timeout=workflow.timedelta(minutes=30),
            )
            return result


async def start_workflow(
    run_id: str,
    user_id: str,
    graph_id: str,
    graph_content: dict[str, Any],
    input_data: dict[str, Any],
    secrets: dict[str, str] | None = None,
    temporal_host: str = "localhost:7233",
) -> None:
    """
    Start a graph execution via Temporal if available,
    otherwise fall back to a plain asyncio task.
    """
    from app.services.execution import execute_graph

    secrets = secrets or {}

    if not _TEMPORAL_AVAILABLE:
        log.info("temporal_not_available_using_asyncio", run_id=run_id)
        asyncio.create_task(
            execute_graph(
                run_id=run_id,
                user_id=user_id,
                graph_id=graph_id,
                graph_content=graph_content,
                input_data=input_data,
                secrets=secrets,
            )
        )
        return

    try:
        client = await Client.connect(temporal_host)
        await client.start_workflow(
            GraphExecutionWorkflow.run,
            args=[
                {
                    "run_id": run_id,
                    "user_id": user_id,
                    "graph_id": graph_id,
                    "graph_content": graph_content,
                    "input_data": input_data,
                    "secrets": secrets,
                }
            ],
            id=run_id,
            task_queue="forge-execution",
        )
        log.info("temporal_workflow_started", run_id=run_id)
    except Exception as exc:
        log.warning("temporal_start_failed_fallback_asyncio", error=str(exc))
        asyncio.create_task(
            execute_graph(
                run_id=run_id,
                user_id=user_id,
                graph_id=graph_id,
                graph_content=graph_content,
                input_data=input_data,
                secrets=secrets,
            )
        )


async def run_worker(temporal_host: str = "localhost:7233") -> None:
    """Entry point for the Temporal worker process."""
    if not _TEMPORAL_AVAILABLE:
        log.error("temporalio_not_installed")
        return

    from temporalio.worker import Worker

    client = await Client.connect(temporal_host)
    worker = Worker(
        client,
        task_queue="forge-execution",
        workflows=[GraphExecutionWorkflow],
        activities=[execute_node_activity],
    )
    log.info("temporal_worker_started", host=temporal_host)
    await worker.run()
