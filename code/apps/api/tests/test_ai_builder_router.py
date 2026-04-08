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
async def test_ai_builder_suggest_workflow_for_slack(client: AsyncClient) -> None:
    response = await client.post(
        "/ai-builder/suggest-workflow",
        json={"prompt": "Summarize support ticket and post to slack"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["nodes"]) >= 1
    node_types = {node["type"] for node in payload["nodes"]}
    assert "mcp_tool" in node_types


@pytest.mark.asyncio
async def test_ai_builder_rejects_empty_prompt(client: AsyncClient) -> None:
    response = await client.post(
        "/ai-builder/suggest-workflow",
        json={"prompt": ""},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_ai_builder_uses_email_digest_template(client: AsyncClient) -> None:
    response = await client.post(
        "/ai-builder/suggest-workflow",
        json={
            "prompt": "Every Monday morning, summarize my weekend Gmail into an action items digest.",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["template_id"] == "email_digest"
    assert payload["parameters"] is not None
    node_types = {node["type"] for node in payload["nodes"]}
    assert "schedule_trigger" in node_types


@pytest.mark.asyncio
async def test_ai_builder_uses_rag_chat_template(client: AsyncClient) -> None:
    response = await client.post(
        "/ai-builder/suggest-workflow",
        json={
            "prompt": "Create a document-to-chat RAG assistant where I upload PDFs and then ask questions.",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["template_id"] == "rag_chat"
    node_types = {node["type"] for node in payload["nodes"]}
    assert "rag_retriever" in node_types


@pytest.mark.asyncio
async def test_ai_builder_suggestion_telemetry_endpoint(client: AsyncClient) -> None:
    response = await client.post(
        "/ai-builder/suggest-workflow/telemetry",
        json={
            "event_type": "applied",
            "template_id": "email_digest",
            "template_name": "Gmail Monday Action-Items Digest",
            "prompt": "Every Monday morning, summarize my weekend Gmail into an action items digest.",
        },
    )
    assert response.status_code == 204
