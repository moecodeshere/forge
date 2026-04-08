"""
MCP tool executor — JSON-RPC 2.0 calls with OAuth/JWT auth header injection.
Each call produces a structured result or raises on JSON-RPC error.
"""
from __future__ import annotations

import uuid
from typing import Any

import httpx
import structlog

log = structlog.get_logger(__name__)

HTTP_TIMEOUT = 30.0


async def call_mcp_tool(
    *,
    server_url: str,
    tool_name: str,
    params: dict[str, Any],
    auth_token: str | None = None,
    auth_type: str = "bearer",
) -> Any:
    """
    Execute a JSON-RPC 2.0 method on an MCP server.

    auth_type: "bearer" | "oauth" | "none"
    Returns the JSON-RPC result field or raises RuntimeError on error.
    """
    if not server_url:
        raise ValueError("server_url is required")
    if not tool_name:
        raise ValueError("tool_name is required")

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if auth_token and auth_type in ("bearer", "oauth"):
        headers["Authorization"] = f"Bearer {auth_token}"

    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": tool_name,
        "params": params,
    }

    endpoint = f"{server_url.rstrip('/')}/rpc"

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"MCP server returned HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        ) from exc
    except httpx.RequestError as exc:
        raise RuntimeError(f"MCP server unreachable: {exc}") from exc

    body: dict[str, Any] = resp.json()

    if "error" in body:
        err = body["error"]
        raise RuntimeError(
            f"MCP JSON-RPC error {err.get('code')}: {err.get('message')}"
        )

    return body.get("result")
