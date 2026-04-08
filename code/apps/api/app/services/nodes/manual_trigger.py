"""
Manual Trigger node plugin.
Pass-through: returns input_data as-is. Used when workflow is started via API.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class ManualTriggerPlugin:
    meta = NodePluginMeta(
        type="manual_trigger",
        category="triggers",
        label="Manual Trigger",
        description="Start workflow manually (Run button or API).",
        inputs=[],
        outputs=["input"],
        config_schema={"type": "object", "properties": {}},
        ui_schema=None,
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        return dict(state.get("_input", {}))


register(ManualTriggerPlugin())
