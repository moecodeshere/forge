"""Tests for GET /nodes API."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_list_nodes_returns_plugins() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/nodes")
    assert response.status_code == 200
    plugins = response.json()
    assert isinstance(plugins, list)
    types = {p["type"] for p in plugins}
    assert "llm_caller" in types
    assert "manual_trigger" in types
    assert "http_request" in types
    for p in plugins:
        assert "type" in p
        assert "category" in p
        assert "label" in p
        assert "config_schema" in p
