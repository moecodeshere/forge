"""
App Event Trigger node plugin (placeholder).
Runs when something happens in an app (Telegram, Notion, etc.). Stub for now.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class AppEventTriggerPlugin:
    meta = NodePluginMeta(
        type="app_event_trigger",
        category="triggers",
        label="App Event",
        description="Runs when something happens in an app like Telegram, Notion or Airtable.",
        inputs=[],
        outputs=["event_data", "input"],
        config_schema={
            "type": "object",
            "properties": {
                "app": {"type": "string", "enum": ["telegram", "notion", "airtable", "other"], "default": "other"},
                "event_type": {"type": "string", "description": "Placeholder for event type"},
            },
        },
        ui_schema={"app": {"widget": "select", "options": ["telegram", "notion", "airtable", "other"]}},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        # Stub: pass through input (real integration via webhook/MCP later)
        input_data = dict(state.get("_input", {}))
        return {"event_data": input_data, "input": input_data}


register(AppEventTriggerPlugin())
