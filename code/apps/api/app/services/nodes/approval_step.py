"""
Approval Step node plugin.
"""
from __future__ import annotations

import asyncio
from typing import Any

from app.models.execution import EventType, ExecutionEvent
from app.services.approval_gates import pop_gate, pop_result, set_gate
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class ApprovalStepPlugin:
    meta = NodePluginMeta(
        type="approval_step",
        category="human",
        label="Approval Step",
        description="Pause execution until human approval.",
        inputs=["request_data"],
        outputs=["approved", "feedback"],
        config_schema={
            "type": "object",
            "properties": {
                "form_schema": {"type": "object"},
                "timeout_seconds": {"type": "integer", "default": 3600},
                "title": {"type": "string"},
                "description": {"type": "string"},
            },
        },
        ui_schema={
            "timeout_seconds": {"widget": "number", "min": 60, "max": 86400},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        form_schema = cfg.get("form_schema", {})
        timeout_seconds = int(cfg.get("timeout_seconds", 3600))

        gate = asyncio.Event()
        set_gate(context.run_id, gate)

        await context.publish(
            ExecutionEvent(
                event_type=EventType.APPROVAL_REQUIRED,
                run_id=context.run_id,
                node_id=node["id"],
                data={
                    "form_schema": form_schema,
                    "node_label": node.get("data", {}).get("label", ""),
                },
            )
        )

        try:
            await asyncio.wait_for(gate.wait(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            pop_gate(context.run_id)
            raise RuntimeError(f"Approval timed out after {timeout_seconds}s")

        pop_gate(context.run_id)
        result = pop_result(context.run_id)
        if not result.get("approved"):
            raise RuntimeError("Execution rejected by approver")
        return result


register(ApprovalStepPlugin())
