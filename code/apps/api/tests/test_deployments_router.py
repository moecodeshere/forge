from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import AuthUser, get_current_user
from app.main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client() -> AsyncClient:
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        id="2f2be583-6b0a-4ea8-ab2b-7c478ef5c27d",
        email="user@example.com",
        role="authenticated",
        raw_claims={},
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_deployment_success(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.routers import deployments as deployments_router

    fake_supabase = MagicMock()
    (
        fake_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value
    ) = MagicMock(data={"id": "graph-1", "title": "Test Graph", "content": {"nodes": [], "edges": []}})
    monkeypatch.setattr(deployments_router, "get_supabase_admin_client", lambda: fake_supabase)

    async def _fake_deploy_graph(**_: object) -> dict[str, str]:
        return {"deployment_id": "dep-1", "deployment_url": "https://example.com"}

    monkeypatch.setattr(deployments_router, "deploy_graph", _fake_deploy_graph)

    response = await client.post("/deployments", json={"graph_id": "graph-1", "deploy_type": "cloud"})
    assert response.status_code == 202
    body = response.json()
    assert body["deployment_id"] == "dep-1"
    assert body["deployment_url"].startswith("https://")


@pytest.mark.asyncio
async def test_create_deployment_invalid_type(client: AsyncClient) -> None:
    response = await client.post(
        "/deployments",
        json={"graph_id": "graph-1", "deploy_type": "unsupported"},
    )
    assert response.status_code == 422
