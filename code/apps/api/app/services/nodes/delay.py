"""
Delay node plugin.
Pause execution for a configurable number of seconds.
"""
from __future__ import annotations

import asyncio
from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class DelayPlugin:
    meta = NodePluginMeta(
        type="delay",
        category="flow",
        label="Delay",
        description="Pause execution for N seconds before continuing.",
        inputs=["data"],
        outputs=["data"],
        config_schema={
            "type": "object",
            "properties": {
                "seconds": {"type": "number", "default": 5, "minimum": 0.1, "maximum": 3600},
            },
        },
        ui_schema={"seconds": {"widget": "number", "min": 0.1, "max": 3600, "step": 1}},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        seconds = float(cfg.get("seconds", 5))
        seconds = max(0.1, min(3600, seconds))

        await asyncio.sleep(seconds)

        inp = state.get("_input", {})
        return {"data": inp, **inp}


register(DelayPlugin())
