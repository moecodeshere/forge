"""
Filter node plugin.
Filter an array by a simple expression.
"""
from __future__ import annotations

from typing import Any

from app.services.expressions import evaluate_expression
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class FilterNodePlugin:
    meta = NodePluginMeta(
        type="filter",
        category="logic",
        label="Filter",
        description="Filter an array by expression (e.g. item.active == true).",
        inputs=["data"],
        outputs=["filtered"],
        config_schema={
            "type": "object",
            "properties": {
                "source_key": {"type": "string", "default": "data"},
                "expr": {"type": "string", "default": "{{item}}"},
            },
        },
        ui_schema={
            "source_key": {"widget": "text", "placeholder": "data"},
            "expr": {"widget": "text", "placeholder": "{{item}} or {{item.active}}"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        source_key = str(cfg.get("source_key", "data"))
        expr = str(cfg.get("expr", "{{item}}"))

        inp = state.get("_input", {})
        arr = inp.get(source_key, inp.get("data", inp.get("body", [])))

        if not isinstance(arr, list):
            arr = [arr] if arr is not None else []

        expr_context = {
            "input": inp,
            **_build_node_context(state.get("_node_outputs", {})),
        }

        filtered: list[Any] = []
        for i, item in enumerate(arr):
            expr_context["item"] = item
            expr_context["index"] = i
            try:
                val = evaluate_expression(expr, expr_context)
                if val:
                    filtered.append(item)
            except Exception:
                pass

        return {"filtered": filtered, "data": filtered}


def _build_node_context(node_outputs: dict[str, Any]) -> dict[str, Any]:
    return node_outputs


register(FilterNodePlugin())
