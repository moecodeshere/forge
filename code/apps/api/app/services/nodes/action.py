"""
Action node plugin — in-app integrations only (Gmail, Slack, Telegram, etc.).
Use this node for built-in actions. For external MCP servers from the registry, use the MCP node.
"""
from __future__ import annotations

from typing import Any

from app.services.expressions import evaluate_expression
from app.services.integrations import IntegrationService
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


def _resolve_params(params: Any, expr_context: dict[str, Any]) -> Any:
    """Resolve {{path}} in strings; recurse into dicts and lists."""
    if isinstance(params, str):
        if "{{" in params and "}}" in params:
            return evaluate_expression(params, expr_context)
        return params
    if isinstance(params, dict):
        return {k: _resolve_params(v, expr_context) for k, v in params.items()}
    if isinstance(params, list):
        return [_resolve_params(v, expr_context) for v in params]
    return params


class ActionPlugin:
    meta = NodePluginMeta(
        type="action",
        category="actions",
        label="Action",
        description="Run a built-in integration: Gmail, Slack, Telegram, Google Search, Sheets, Notion.",
        inputs=["params"],
        outputs=["output"],
        config_schema={
            "type": "object",
            "properties": {
                "provider": {"type": "string"},
                "action": {"type": "string"},
                "params": {"type": "object"},
                "test_mode": {"type": "boolean", "default": True},
            },
        },
        ui_schema={
            "provider": {"widget": "text", "placeholder": "gmail, slack, telegram"},
            "action": {"widget": "text", "placeholder": "send_email, post_message"},
            "params": {"widget": "json"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        provider = str(cfg.get("provider", "")).strip()
        action = str(cfg.get("action", "")).strip()
        if not provider or not action:
            return {"output": None, "error": "Action node requires provider and action (e.g. gmail, send_email)."}
        merged_params = {**cfg.get("params", {}), **state.get("_input", {})}
        expr_context = {"input": state.get("_input", {}), **state.get("_node_outputs", {})}
        merged_params = _resolve_params(merged_params, expr_context)
        secrets = state.get("_secrets")
        if not isinstance(secrets, dict):
            secrets = None
        service = IntegrationService()
        result = await service.execute(
            provider=provider,
            action=action,
            payload=merged_params,
            test_mode=bool(cfg.get("test_mode", True)),
            secrets=secrets,
        )
        return {"output": result}


register(ActionPlugin())
