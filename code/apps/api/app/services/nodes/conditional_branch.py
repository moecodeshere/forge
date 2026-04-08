"""
Conditional Branch node plugin.
Returns (output, branch_override) for branch selection.
"""
from __future__ import annotations

import structlog
from typing import Any

from app.services.conditional_branch import evaluate_condition
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register

log = structlog.get_logger(__name__)


def _outgoing_edges(graph_content: dict, node_id: str) -> list[dict]:
    return [e for e in graph_content.get("edges", []) if e.get("source") == node_id]


class ConditionalBranchPlugin:
    meta = NodePluginMeta(
        type="conditional_branch",
        category="logic",
        label="Conditional Branch",
        description="Branch execution based on a condition.",
        inputs=["value"],
        outputs=["result", "branch"],
        config_schema={
            "type": "object",
            "properties": {
                "expression": {"type": "string", "default": "true"},
                "expr": {"type": "string"},
            },
        },
        ui_schema={
            "expression": {
                "widget": "text",
                "placeholder": "e.g. value > 0 or role == 'admin'",
            },
            "expr": {"widget": "text"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> tuple[dict[str, Any], str | None]:
        cfg = node.get("data", {}).get("config", {})
        expression = cfg.get("expression") or cfg.get("expr") or "true"

        edges = _outgoing_edges(context.graph_content, node["id"])
        true_edge = next((e for e in edges if e.get("label") == "true"), edges[0] if edges else None)
        false_edge = next(
            (e for e in edges if e.get("label") == "false"),
            edges[1] if len(edges) > 1 else None,
        )

        true_target = true_edge["target"] if true_edge else None
        false_target = false_edge["target"] if false_edge else None

        result = False
        try:
            result = evaluate_condition(expression, state)
        except Exception as exc:
            log.warning("condition_eval_error", error=str(exc))

        chosen = true_target if result else false_target
        return {"result": result, "branch": "true" if result else "false"}, chosen


register(ConditionalBranchPlugin())
