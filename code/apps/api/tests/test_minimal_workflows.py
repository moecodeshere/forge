from __future__ import annotations

"""
Smoke tests for minimal end-to-end workflows using the node plugins.

These tests do not hit real external services. They rely on:
- Mocked Redis + Supabase (same pattern as test_execution.py)
- Mocked LiteLLM so LLM calls always succeed
- Mocked IntegrationService so mcp_tool integration calls succeed
"""

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_manual_simple_llm_to_gmail_flow_executes() -> None:
    """Manual trigger -> simple_llm -> mcp_tool (gmail send) should complete."""
    from app.services import execution, llm_caller

    graph: dict[str, Any] = {
        "nodes": [
            {
                "id": "manual_1",
                "type": "manual_trigger",
                "data": {"label": "Start manually", "config": {}},
            },
            {
                "id": "llm_simple_1",
                "type": "simple_llm",
                "data": {
                    "label": "Write summary",
                    "config": {
                        "model": "gpt-4o-mini",
                        "prompt": "Summarize {{input.text}} in one short sentence.",
                        "temperature": 0.3,
                        "max_tokens": 64,
                    },
                },
            },
            {
                "id": "gmail_send_1",
                "type": "mcp_tool",
                "data": {
                    "label": "Send Gmail",
                    "config": {
                        "provider": "gmail",
                        "action": "send_email",
                        "params": {
                            "to": "me@example.com",
                            "subject": "Test summary email",
                        },
                        "test_mode": True,
                    },
                },
            },
        ],
        "edges": [
            {"id": "e1", "source": "manual_1", "target": "llm_simple_1"},
            {"id": "e2", "source": "llm_simple_1", "target": "gmail_send_1"},
        ],
    }

    published_events: list[str] = []

    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(side_effect=lambda _ch, msg: published_events.append(msg))
    mock_redis.aclose = AsyncMock()

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock(data={})
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
        MagicMock(data={})
    )
    mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data={})

    class _MockIntegrationService:
        async def execute(
            self,
            *,
            provider: str,
            action: str,
            payload: dict[str, Any],
            test_mode: bool,
            secrets: dict[str, str] | None = None,
        ) -> dict[str, Any]:
            return {
                "provider": provider,
                "action": action,
                "payload": payload,
                "test_mode": test_mode,
            }

    with (
        patch("app.services.execution._get_redis", AsyncMock(return_value=mock_redis)),
        patch("app.services.execution.get_supabase_admin_client", return_value=mock_supabase),
        patch.object(llm_caller, "_LITELLM_AVAILABLE", False),
        patch("app.services.integrations.IntegrationService", _MockIntegrationService),
    ):
        await execution.execute_graph(
            run_id="run-minimal-1",
            user_id="user-1",
            graph_id="graph-minimal-1",
            graph_content=graph,
            input_data={"text": "Hello from minimal workflow"},
        )

    event_types = [json.loads(e)["event_type"] for e in published_events]
    assert "execution_completed" in event_types


@pytest.mark.asyncio
async def test_schedule_agent_to_http_flow_executes() -> None:
    """Schedule trigger -> ai_agent -> http_request should complete."""
    from app.services import execution, llm_caller

    graph: dict[str, Any] = {
        "nodes": [
            {
                "id": "schedule_1",
                "type": "schedule_trigger",
                "data": {
                    "label": "Every hour",
                    "config": {"schedule_type": "interval", "interval_value": 1, "interval_unit": "hours"},
                },
            },
            {
                "id": "agent_1",
                "type": "ai_agent",
                "data": {
                    "label": "Decide next action",
                    "config": {
                        "model": "gpt-4o-mini",
                        "system_prompt": "Decide whether we should ping the status API.",
                        "tools": ["status_api"],
                        "memory_source": "recent_runs",
                        "output_mode": "text",
                    },
                },
            },
            {
                "id": "http_1",
                "type": "http_request",
                "data": {
                    "label": "Ping status API",
                    "config": {
                        "method": "GET",
                        "url": "https://example.com/status",
                    },
                },
            },
        ],
        "edges": [
            {"id": "e1", "source": "schedule_1", "target": "agent_1"},
            {"id": "e2", "source": "agent_1", "target": "http_1"},
        ],
    }

    published_events: list[str] = []

    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(side_effect=lambda _ch, msg: published_events.append(msg))
    mock_redis.aclose = AsyncMock()

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock(data={})
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
        MagicMock(data={})
    )
    mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data={})

    async def _fake_http_request(*args: Any, **kwargs: Any) -> dict[str, Any]:
        return {"status": 200, "body": {"ok": True}, "headers": {}}

    with (
        patch("app.services.execution._get_redis", AsyncMock(return_value=mock_redis)),
        patch("app.services.execution.get_supabase_admin_client", return_value=mock_supabase),
        patch.object(llm_caller, "_LITELLM_AVAILABLE", False),
        patch("app.services.nodes.http_request.HttpRequestPlugin.execute", side_effect=_fake_http_request),
    ):
        await execution.execute_graph(
            run_id="run-agent-1",
            user_id="user-1",
            graph_id="graph-agent-1",
            graph_content=graph,
            input_data={},
        )

    event_types = [json.loads(e)["event_type"] for e in published_events]
    assert "execution_completed" in event_types

