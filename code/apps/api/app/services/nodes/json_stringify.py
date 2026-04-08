"""
JSON Stringify node plugin.
Serialize an object to a JSON string.
"""
from __future__ import annotations

import json
from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class JsonStringifyPlugin:
    meta = NodePluginMeta(
        type="json_stringify",
        category="data",
        label="JSON Stringify",
        description="Serialize an object to a JSON string.",
        inputs=["data"],
        outputs=["json_string"],
        config_schema={
            "type": "object",
            "properties": {
                "source_key": {"type": "string", "default": "data"},
            },
        },
        ui_schema={"source_key": {"widget": "text", "placeholder": "data"}},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        source_key = str(cfg.get("source_key", "data"))

        inp = state.get("_input", {})
        obj = inp.get(source_key, inp.get("data", {}))

        json_string = json.dumps(obj) if obj is not None else "{}"
        return {"json_string": json_string}


register(JsonStringifyPlugin())
