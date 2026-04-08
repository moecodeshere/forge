"""
Template (render) node plugin.
Renders text/HTML from state using {{path}} expressions.
"""
from __future__ import annotations

from typing import Any

from app.services.expressions import evaluate_expression
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


def _build_expr_context(state: dict[str, Any]) -> dict[str, Any]:
    inp = state.get("_input", {})
    node_outputs = state.get("_node_outputs", {})
    return {"input": inp, **node_outputs}


class TemplateRenderPlugin:
    meta = NodePluginMeta(
        type="template_render",
        category="data",
        label="Template (Render)",
        description="Render text or HTML from a template using {{input.x}} or {{nodeId.key}}.",
        inputs=["template", "data"],
        outputs=["rendered", "output"],
        config_schema={
            "type": "object",
            "properties": {
                "template": {"type": "string", "description": "Template with {{path}} placeholders"},
                "output_key": {"type": "string", "default": "rendered"},
            },
        },
        ui_schema={
            "template": {"widget": "textarea", "placeholder": "Hello {{input.name}}, result: {{output}}"},
            "output_key": {"widget": "text"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        expr_ctx = _build_expr_context(state)
        template = (cfg.get("template") or "").strip()
        output_key = (cfg.get("output_key") or "rendered").strip() or "rendered"
        if not template:
            return {"rendered": "", "output": "", **{output_key: ""}}
        rendered = evaluate_expression(template, expr_ctx)
        if not isinstance(rendered, str):
            rendered = str(rendered) if rendered is not None else ""
        return {"rendered": rendered, "output": rendered, **{output_key: rendered}}


register(TemplateRenderPlugin())
