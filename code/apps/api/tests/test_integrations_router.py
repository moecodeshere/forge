from __future__ import annotations

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
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_connectors(client: AsyncClient) -> None:
    response = await client.get("/integrations/connectors")
    assert response.status_code == 200
    payload = response.json()
    keys = {item["key"] for item in payload}
    assert {"slack", "gmail", "sheets", "notion"}.issubset(keys)


@pytest.mark.asyncio
async def test_execute_connector_action_mock_mode(client: AsyncClient) -> None:
    response = await client.post(
        "/integrations/slack/actions/post_message",
        json={"payload": {"channel": "#alerts", "text": "hello"}, "test_mode": True},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "slack"
    assert body["status"] in {"mock_success", "connected_stub"}


@pytest.mark.asyncio
async def test_execute_unknown_provider_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/integrations/unknown/actions/do",
        json={"payload": {}, "test_mode": True},
    )
    assert response.status_code == 404
    assert "Unknown integration provider" in response.json()["detail"]


@pytest.mark.asyncio
async def test_execute_unsupported_action_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/integrations/slack/actions/not_supported",
        json={"payload": {}, "test_mode": True},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_provider_name_is_normalized(client: AsyncClient) -> None:
    response = await client.post(
        "/integrations/Slack/actions/post_message",
        json={"payload": {"channel": "#alerts", "text": "hello"}, "test_mode": True},
    )
    assert response.status_code == 200
    assert response.json()["provider"] == "slack"


@pytest.mark.asyncio
async def test_live_mode_without_token_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/integrations/gmail/actions/send_email",
        json={"payload": {"to": "a@b.com", "subject": "x"}, "test_mode": False},
    )
    assert response.status_code == 400
    assert "not configured" in response.json()["detail"]

