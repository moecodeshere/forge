"""
MCP Tool node plugin.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class MCPToolPlugin:
    meta = NodePluginMeta(
        type="mcp_tool",
        category="actions",
        label="MCP Tool",
        description="Execute external tool via integration or MCP JSON-RPC.",
        inputs=["params"],
        outputs=["output"],
        config_schema={
            "type": "object",
            "properties": {
                "provider": {"type": "string"},
                "action": {"type": "string"},
                "server_url": {"type": "string"},
                "tool_name": {"type": "string"},
                "params": {"type": "object"},
                "test_mode": {"type": "boolean", "default": True},
            },
        },
        ui_schema={
            "provider": {"widget": "text", "placeholder": "slack, gmail, sheets, notion"},
            "action": {"widget": "text", "placeholder": "post_message, send_email"},
            "params": {"widget": "json"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        try:
            cfg = node.get("data", {}).get("config", {})
            merged_params = {**cfg.get("params", {}), **state.get("_input", {})}

            provider = str(cfg.get("provider", "")).strip()
            action = str(cfg.get("action", "")).strip()
            server_url = str(cfg.get("server_url", "")).strip()
            tool_name = str(cfg.get("tool_name", "")).strip()

            if (provider and not action) or (action and not provider):
                raise ValueError(
                    "mcp_tool config requires both provider and action when using integrations"
                )
            if (server_url and not tool_name) or (tool_name and not server_url):
                raise ValueError(
                    "mcp_tool config requires both server_url and tool_name for MCP fallback"
                )

            if provider and action:
                from app.services.integrations import IntegrationService

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

            from app.services.mcp_executor import call_mcp_tool

            result = await call_mcp_tool(
                server_url=server_url,
                tool_name=tool_name,
                params=merged_params,
            )
            return {"output": result}
        except ImportError:
            return {"output": None, "error": "MCP executor not yet available"}


register(MCPToolPlugin())
