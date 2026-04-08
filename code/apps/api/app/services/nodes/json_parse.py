"""
JSON Parse node plugin.
Parse a JSON string from input into an object.
"""
from __future__ import annotations

import json
from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class JsonParsePlugin:
    meta = NodePluginMeta(
        type="json_parse",
        category="data",
        label="JSON Parse",
        description="Parse a JSON string into an object.",
        inputs=["data"],
        outputs=["data"],
        config_schema={
            "type": "object",
            "properties": {
                "source_key": {"type": "string", "default": "body"},
            },
        },
        ui_schema={"source_key": {"widget": "text", "placeholder": "body"}},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        source_key = str(cfg.get("source_key", "body"))

        inp = state.get("_input", {})
        raw = inp.get(source_key, inp.get("body", ""))

        if isinstance(raw, (dict, list)):
            parsed = raw
        else:
            raw_str = str(raw) if raw is not None else "{}"
            try:
                parsed = json.loads(raw_str)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in '{source_key}': {e}") from e

        return {"data": parsed}


register(JsonParsePlugin())
