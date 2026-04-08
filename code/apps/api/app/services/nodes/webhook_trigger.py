"""
Webhook Trigger node plugin.
Produces the webhook request payload as output. Used when workflow is started via webhook.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class WebhookTriggerPlugin:
    meta = NodePluginMeta(
        type="webhook_trigger",
        category="triggers",
        label="Webhook Trigger",
        description="Start workflow via HTTP webhook (POST).",
        inputs=[],
        outputs=["body", "headers"],
        config_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string"},
            },
        },
        ui_schema=None,
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        # Webhook payload is passed as _input when execution is started by webhook route
        inp = state.get("_input", {})
        return {
            "body": inp.get("body", inp),
            "headers": inp.get("headers", {}),
            **{k: v for k, v in inp.items() if k not in ("body", "headers")},
        }


register(WebhookTriggerPlugin())
