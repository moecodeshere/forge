"""
Schedule Trigger node plugin.
Runs workflow on a schedule (cron/interval). MVP: stub execution; full cron requires worker.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class ScheduleTriggerPlugin:
    meta = NodePluginMeta(
        type="schedule_trigger",
        category="triggers",
        label="Schedule Trigger",
        description="Run the workflow every day, hour, or custom interval.",
        inputs=[],
        outputs=["triggered_at", "input"],
        config_schema={
            "type": "object",
            "properties": {
                "schedule_type": {"type": "string", "enum": ["interval", "cron"], "default": "interval"},
                "interval_value": {"type": "integer", "minimum": 1},
                "interval_unit": {"type": "string", "enum": ["minutes", "hours", "days"], "default": "hours"},
                "cron_expression": {"type": "string", "description": "e.g. 0 * * * * for hourly"},
            },
        },
        ui_schema={
            "schedule_type": {"widget": "select", "options": ["interval", "cron"]},
            "interval_unit": {"widget": "select", "options": ["minutes", "hours", "days"]},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        # MVP: when run manually, pass through input like manual trigger
        import time
        return {
            "triggered_at": time.time(),
            **dict(state.get("_input", {})),
        }


register(ScheduleTriggerPlugin())
