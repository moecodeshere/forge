"""
Set node plugin.
Add, remove, rename fields; map values.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class SetNodePlugin:
    meta = NodePluginMeta(
        type="set_node",
        category="data",
        label="Set",
        description="Add, remove, or rename fields in the data.",
        inputs=["data"],
        outputs=["data"],
        config_schema={
            "type": "object",
            "properties": {
                "mode": {"type": "string", "enum": ["add", "merge", "replace"], "default": "merge"},
                "fields": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "key": {"type": "string"},
                            "value": {"type": "string"},
                            "action": {"type": "string", "enum": ["set", "remove", "rename"]},
                            "rename_to": {"type": "string"},
                        },
                    },
                },
            },
        },
        ui_schema={"fields": {"widget": "array"}},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        mode = cfg.get("mode", "merge")
        fields = cfg.get("fields") or []

        inp = state.get("_input", {})
        if mode == "replace":
            result: dict[str, Any] = {}
        else:
            result = dict(inp)

        for f in fields:
            if not isinstance(f, dict):
                continue
            action = f.get("action", "set")
            key = f.get("key", "")
            if not key:
                continue
            if action == "remove":
                result.pop(key, None)
            elif action == "rename":
                rename_to = f.get("rename_to", "")
                if rename_to and key in result:
                    result[rename_to] = result.pop(key)
            else:
                result[key] = f.get("value", "")

        return {"data": result, **result}


register(SetNodePlugin())
