"""
Loop / For Each node plugin.
Iterates over an array and runs the connected "body" node once per item.
Outputs: results (list), count, item (last item).
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import get_plugin, register


def _outgoing_edges(graph_content: dict, node_id: str) -> list[dict]:
    return [e for e in graph_content.get("edges", []) if e.get("source") == node_id]


def _get_node(graph_content: dict, node_id: str) -> dict | None:
    for n in graph_content.get("nodes", []):
        if n.get("id") == node_id:
            return n
    return None


class LoopPlugin:
    meta = NodePluginMeta(
        type="loop",
        category="flow",
        label="Loop (For Each)",
        description="Run the next node once for each item in an array. Use {{item}} and {{index}} in the body node.",
        inputs=["items", "array"],
        outputs=["results", "count", "item"],
        config_schema={
            "type": "object",
            "properties": {
                "array_key": {"type": "string", "default": "items", "description": "Key in input containing the array"},
            },
        },
        ui_schema={"array_key": {"widget": "text", "placeholder": "items"}},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        array_key = (cfg.get("array_key") or "items").strip() or "items"
        inp = state.get("_input", {})
        node_outputs = dict(state.get("_node_outputs", {}))
        secrets = state.get("_secrets") or {}

        items = inp.get(array_key) or inp.get("array") or []
        if not isinstance(items, (list, tuple)):
            return {"results": [], "count": 0, "item": None, "error": f"'{array_key}' is not an array"}

        edges = _outgoing_edges(context.graph_content, node["id"])
        if not edges:
            return {"results": [], "count": 0, "item": None, "error": "Connect this node to a body node (e.g. HTTP, Set, LLM)."}
        body_node_id = edges[0]["target"]
        body_node = _get_node(context.graph_content, body_node_id)
        if not body_node:
            return {"results": [], "count": 0, "item": None, "error": f"Body node {body_node_id} not found."}
        body_plugin = get_plugin(body_node.get("type", ""))
        if not body_plugin:
            return {"results": [], "count": 0, "item": None, "error": f"Unknown body node type: {body_node.get('type')}."}

        results = []
        for i, item in enumerate(items):
            iter_input = {**inp, "item": item, "index": i}
            iter_node_outputs = {**node_outputs}
            state_snapshot: dict[str, Any] = {
                "_input": iter_input,
                "_node_outputs": iter_node_outputs,
                "_secrets": secrets,
            }
            try:
                out = await body_plugin.execute(body_node, state_snapshot, context)
                if isinstance(out, tuple):
                    out = out[0]
                results.append(out)
            except Exception as e:
                results.append({"error": str(e), "index": i})
        last_item = items[-1] if items else None
        return {"results": results, "count": len(results), "item": last_item}


register(LoopPlugin())
