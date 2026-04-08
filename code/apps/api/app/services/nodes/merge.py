"""
Merge node plugin.
Combine multiple branch outputs into a single object.
The execution engine already merges predecessor outputs into _input;
this node provides an explicit join point and supports shallow/deep merge modes.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


def _get_predecessors(graph_content: dict[str, Any], node_id: str) -> list[str]:
    edges = graph_content.get("edges", [])
    return [e["source"] for e in edges if e.get("target") == node_id]


def _deep_merge(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in overlay.items():
        if k.startswith("_"):
            continue
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


class MergePlugin:
    meta = NodePluginMeta(
        type="merge",
        category="data",
        label="Merge",
        description="Combine multiple branch outputs into one object.",
        inputs=["data"],
        outputs=["data"],
        config_schema={
            "type": "object",
            "properties": {
                "mode": {"type": "string", "enum": ["shallow", "deep"], "default": "shallow"},
            },
        },
        ui_schema={"mode": {"widget": "select", "options": ["shallow", "deep"]}},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        mode = str(cfg.get("mode", "shallow"))

        node_outputs = state.get("_node_outputs", {})
        pred_ids = _get_predecessors(context.graph_content, node["id"])

        result: dict[str, Any] = {}
        for pred_id in pred_ids:
            pred_out = node_outputs.get(pred_id, {})
            if not isinstance(pred_out, dict):
                continue
            clean = {k: v for k, v in pred_out.items() if not k.startswith("_")}
            if mode == "deep":
                result = _deep_merge(result, clean)
            else:
                result.update(clean)

        return {"data": result, **result}


register(MergePlugin())
