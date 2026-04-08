"""
MCP gateway & executor tests.
Uses a mock HTTP server to simulate JSON-RPC 2.0 calls.
"""
from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ──────────────────────────────────────────────────────────────────────────────
# MCP executor
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_call_mcp_tool_success() -> None:
    from app.services.mcp_executor import call_mcp_tool

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "jsonrpc": "2.0",
        "id": "1",
        "result": {"issue_url": "https://github.com/org/repo/issues/42"},
    }
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await call_mcp_tool(
            server_url="https://mcp.example.com",
            tool_name="github/create_issue",
            params={"title": "Bug report", "body": "Details"},
            auth_token="tok_123",
        )

    assert result == {"issue_url": "https://github.com/org/repo/issues/42"}


@pytest.mark.asyncio
async def test_call_mcp_tool_jsonrpc_error() -> None:
    from app.services.mcp_executor import call_mcp_tool

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "jsonrpc": "2.0",
        "id": "1",
        "error": {"code": -32601, "message": "Method not found"},
    }
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(RuntimeError, match="JSON-RPC error"):
            await call_mcp_tool(
                server_url="https://mcp.example.com",
                tool_name="unknown/tool",
                params={},
            )


@pytest.mark.asyncio
async def test_call_mcp_tool_missing_url() -> None:
    from app.services.mcp_executor import call_mcp_tool

    with pytest.raises(ValueError, match="server_url"):
        await call_mcp_tool(server_url="", tool_name="tool", params={})


# ──────────────────────────────────────────────────────────────────────────────
# MCP gateway (cache)
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_tools_returns_cached() -> None:
    from app.services import mcp_gateway

    cache_hit = json.dumps([{"name": "github", "description": "GitHub tools"}])

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=cache_hit)
    mock_redis.aclose = AsyncMock()

    with patch.object(mcp_gateway, "_get_redis", AsyncMock(return_value=mock_redis)):
        results = await mcp_gateway.search_tools("github")

    assert len(results) == 1
    assert results[0]["name"] == "github"
    # Should NOT make HTTP call since cache hit
    mock_redis.setex.assert_not_called()
