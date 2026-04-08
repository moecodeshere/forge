"""
HTTP Request node plugin.
"""
from __future__ import annotations

from typing import Any

from app.services.expressions import evaluate_expression
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class HttpRequestPlugin:
    meta = NodePluginMeta(
        type="http_request",
        category="actions",
        label="HTTP Request",
        description="Make an HTTP request to any API.",
        inputs=["url", "body"],
        outputs=["status", "body", "headers"],
        config_schema={
            "type": "object",
            "properties": {
                "method": {"type": "string", "default": "GET"},
                "url": {"type": "string"},
                "headers": {"type": "object"},
                "query": {"type": "object"},
                "body": {"type": "string"},
                "auth_type": {"type": "string", "enum": ["none", "bearer", "basic"], "default": "none"},
                "auth_token": {"type": "string"},
            },
        },
        ui_schema={
            "method": {"widget": "select", "options": ["GET", "POST", "PUT", "PATCH", "DELETE"]},
            "url": {"widget": "text", "placeholder": "https://api.example.com/..."},
            "headers": {"widget": "json"},
            "body": {"widget": "textarea"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        try:
            import httpx
        except ImportError:
            raise RuntimeError("httpx not installed; pip install httpx")

        cfg = node.get("data", {}).get("config", {})
        expr_context = {
            "input": state.get("_input", {}),
            **_build_node_context(state.get("_node_outputs", {})),
        }

        method = str(cfg.get("method", "GET")).upper()
        url_raw = cfg.get("url", "") or ""
        url = (
            evaluate_expression(url_raw, expr_context)
            if isinstance(url_raw, str)
            else str(url_raw)
        )
        headers = cfg.get("headers") or {}
        query = cfg.get("query") or {}
        body_raw = cfg.get("body", "")
        body = (
            evaluate_expression(body_raw, expr_context)
            if isinstance(body_raw, str)
            else body_raw
        )
        auth_type = cfg.get("auth_type", "none")
        auth_token = cfg.get("auth_token", "")

        if not url:
            raise ValueError("HTTP Request requires a URL")

        request_headers = dict(headers) if isinstance(headers, dict) else {}
        if auth_type == "bearer" and auth_token:
            token = (
                evaluate_expression(auth_token, expr_context)
                if isinstance(auth_token, str)
                else str(auth_token)
            )
            request_headers["Authorization"] = f"Bearer {token}"
        elif auth_type == "basic" and auth_token:
            import base64
            token = (
                evaluate_expression(auth_token, expr_context)
                if isinstance(auth_token, str)
                else str(auth_token)
            )
            request_headers["Authorization"] = f"Basic {base64.b64encode(token.encode()).decode()}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(
                method=method,
                url=url,
                params=query,
                headers=request_headers or None,
                content=body if body and method != "GET" else None,
            )

        try:
            resp_body = resp.json()
        except Exception:
            resp_body = resp.text

        return {
            "status": resp.status_code,
            "body": resp_body,
            "headers": dict(resp.headers),
        }


def _build_node_context(node_outputs: dict[str, Any]) -> dict[str, Any]:
    """Flatten node outputs for expression context: nodeId -> output dict."""
    return node_outputs


register(HttpRequestPlugin())
