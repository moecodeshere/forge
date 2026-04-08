"""
Execution engine tests.
- LLM caller: mock litellm.acompletion and verify token stream
- Execution service: mock Redis + Supabase, verify event sequence
- Checkpoint: encrypt → decrypt roundtrip
- Conditional branch: expression evaluation
"""
from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ──────────────────────────────────────────────────────────────────────────────
# Checkpoint tests
# ──────────────────────────────────────────────────────────────────────────────


def test_checkpoint_roundtrip() -> None:
    from app.services.checkpoint import decrypt_state, encrypt_state

    state = {"messages": ["hello"], "score": 0.95, "nested": {"k": [1, 2]}}
    blob = encrypt_state(state)
    assert isinstance(blob, str)
    recovered = decrypt_state(blob)
    assert recovered == state


def test_checkpoint_blobs_are_different() -> None:
    from app.services.checkpoint import encrypt_state

    # Different nonces each call
    state = {"x": 1}
    b1 = encrypt_state(state)
    b2 = encrypt_state(state)
    assert b1 != b2


# ──────────────────────────────────────────────────────────────────────────────
# Conditional branch tests
# ──────────────────────────────────────────────────────────────────────────────


def test_condition_true() -> None:
    from app.services.conditional_branch import evaluate_condition

    assert evaluate_condition("score > 0.5", {"score": 0.9}) is True


def test_condition_false() -> None:
    from app.services.conditional_branch import evaluate_condition

    assert evaluate_condition("score > 0.5", {"score": 0.1}) is False


def test_condition_string_comparison() -> None:
    from app.services.conditional_branch import evaluate_condition

    assert evaluate_condition("role == 'admin'", {"role": "admin"}) is True
    assert evaluate_condition("role == 'admin'", {"role": "user"}) is False


def test_condition_empty_raises() -> None:
    from app.services.conditional_branch import evaluate_condition

    with pytest.raises(ValueError, match="Empty expression"):
        evaluate_condition("", {})


# ──────────────────────────────────────────────────────────────────────────────
# LLM caller mock tests
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_llm_stream_mock_fallback() -> None:
    """When litellm is not available the fallback yields tokens."""
    from app.services import llm_caller

    with patch.object(llm_caller, "_LITELLM_AVAILABLE", False):
        tokens: list[str] = []
        async for tok in llm_caller.stream_llm_tokens(
            model="gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
        ):
            tokens.append(tok)

    assert len(tokens) > 0
    combined = "".join(tokens)
    assert "Mock LLM" in combined


@pytest.mark.asyncio
async def test_llm_call_full_response_mock() -> None:
    from app.services import llm_caller

    with patch.object(llm_caller, "_LITELLM_AVAILABLE", False):
        result = await llm_caller.call_llm(
            model="gpt-4o", messages=[{"role": "user", "content": "hello"}]
        )

    assert isinstance(result, str)
    assert len(result) > 0


# ──────────────────────────────────────────────────────────────────────────────
# Execution engine tests (mocked Redis + Supabase)
# ──────────────────────────────────────────────────────────────────────────────

SIMPLE_GRAPH: dict[str, Any] = {
    "nodes": [
        {
            "id": "node-1",
            "type": "llm_caller",
            "data": {
                "config": {
                    "model": "gpt-4o-mini",
                    "system_prompt": "You are helpful.",
                    "temperature": 0.5,
                    "max_tokens": 128,
                }
            },
        }
    ],
    "edges": [],
}


@pytest.mark.asyncio
async def test_execute_graph_emits_events() -> None:
    from app.services import execution, llm_caller

    published_events: list[str] = []

    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(side_effect=lambda ch, msg: published_events.append(msg))
    mock_redis.aclose = AsyncMock()

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock(data={})
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
        MagicMock(data={})
    )
    mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data={})

    with (
        patch("app.services.execution._get_redis", AsyncMock(return_value=mock_redis)),
        patch("app.services.execution.get_supabase_admin_client", return_value=mock_supabase),
        patch.object(llm_caller, "_LITELLM_AVAILABLE", False),
    ):
        await execution.execute_graph(
            run_id="run-test-1",
            user_id="user-1",
            graph_id="graph-1",
            graph_content=SIMPLE_GRAPH,
            input_data={"query": "hello"},
        )

    event_types = [json.loads(e)["event_type"] for e in published_events]
    assert "node_started" in event_types
    assert "node_completed" in event_types
    assert "execution_completed" in event_types


@pytest.mark.asyncio
async def test_execute_graph_retries_on_failure() -> None:
    """Node that fails twice then succeeds should still complete."""
    from app.services import execution
    from app.services.nodes import get_plugin

    call_count = 0

    async def flaky_execute(*args: Any, **kwargs: Any) -> dict[str, Any]:
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise RuntimeError("transient error")
        return {"output": "ok", "token_count": 2}

    mock_plugin = MagicMock()
    mock_plugin.execute = AsyncMock(side_effect=flaky_execute)
    original_get_plugin = get_plugin

    def mock_get_plugin(node_type: str) -> Any:
        if node_type == "llm_caller":
            return mock_plugin
        return original_get_plugin(node_type)

    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    mock_redis.aclose = AsyncMock()
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock(data={})
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
        MagicMock(data={})
    )
    mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data={})

    with (
        patch("app.services.execution._get_redis", AsyncMock(return_value=mock_redis)),
        patch("app.services.execution.get_supabase_admin_client", return_value=mock_supabase),
        patch("app.services.execution.get_plugin", side_effect=mock_get_plugin),
        patch("asyncio.sleep", AsyncMock()),
    ):
        await execution.execute_graph(
            run_id="run-test-2",
            user_id="user-1",
            graph_id="graph-1",
            graph_content=SIMPLE_GRAPH,
            input_data={},
        )

    assert call_count == 3


@pytest.mark.asyncio
async def test_execute_graph_stops_when_cancelled() -> None:
    from app.services import execution

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

    with (
        patch("app.services.execution._get_redis", AsyncMock(return_value=mock_redis)),
        patch("app.services.execution.get_supabase_admin_client", return_value=mock_supabase),
        patch("app.services.execution._get_run_status", return_value="cancelled"),
    ):
        await execution.execute_graph(
            run_id="run-cancel-1",
            user_id="user-1",
            graph_id="graph-1",
            graph_content=SIMPLE_GRAPH,
            input_data={},
        )

    event_types = [json.loads(e)["event_type"] for e in published_events]
    assert "execution_cancelled" in event_types
    assert "node_started" not in event_types
