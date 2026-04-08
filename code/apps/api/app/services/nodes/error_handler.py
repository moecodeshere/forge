"""
Error handler node plugin.
Receives _error from state when the executor routes here after a previous node failed.
Useful for notifying, logging, or fallback paths.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class ErrorHandlerPlugin:
    meta = NodePluginMeta(
        type="error_handler",
        category="flow",
        label="Error Handler",
        description="Runs when a connected node fails. Receives error message in input; use for alerts or fallback.",
        inputs=["_error", "error"],
        outputs=["handled", "message"],
        config_schema={
            "type": "object",
            "properties": {},
        },
        ui_schema={},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        inp = state.get("_input", {})
        err = inp.get("_error") or inp.get("error") or {}
        if isinstance(err, str):
            message = err
        else:
            message = err.get("message", err.get("error", str(err)))
        return {"handled": True, "message": message, "error": message}


register(ErrorHandlerPlugin())
