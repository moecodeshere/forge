"""
LiteLLM wrapper for streaming LLM calls.
Supports: gpt-4o, gpt-4o-mini, claude-3-5-sonnet, gemini-2.0-flash, and any model
accepted by LiteLLM (100+ providers via unified interface).
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any

import structlog

log = structlog.get_logger(__name__)

_LITELLM_AVAILABLE = False
try:
    import litellm  # type: ignore[import-untyped]

    litellm.drop_params = True  # ignore unsupported params per-provider
    _LITELLM_AVAILABLE = True
except ImportError:
    pass

AUTH_ERROR_MSG = (
    "API key invalid or missing. Enter your API key in Run settings on the canvas, "
    "or set OPENAI_API_KEY in your environment. See https://platform.openai.com/account/api-keys"
)


def _raise_friendly_if_auth_error(exc: BaseException) -> None:
    """Re-raise with a user-friendly message if this is an auth/API key error."""
    msg = str(exc).lower()
    if "incorrect api key" in msg or "authenticationerror" in msg or "openai_exception" in msg:
        raise RuntimeError(AUTH_ERROR_MSG) from exc
    raise exc


def _api_key_from_secrets(model: str, secrets: dict[str, str] | None) -> str | None:
    """Pick the right API key from user-provided secrets by model name."""
    if not secrets:
        return None
    m = model.lower()
    if "perplexity" in m:
        return secrets.get("PERPLEXITY_API_KEY") or secrets.get("perplexity_api_key")
    if m.startswith("gpt-") or "openai" in m:
        return secrets.get("OPENAI_API_KEY") or secrets.get("openai_api_key")
    if "claude" in m:
        return secrets.get("ANTHROPIC_API_KEY") or secrets.get("anthropic_api_key")
    if "gemini" in m:
        return secrets.get("GOOGLE_API_KEY") or secrets.get("google_api_key")
    return secrets.get("OPENAI_API_KEY") or secrets.get("openai_api_key")


async def stream_llm_tokens(
    *,
    model: str,
    messages: list[dict[str, Any]],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    system_prompt: str | None = None,
    secrets: dict[str, str] | None = None,
) -> AsyncIterator[str]:
    """Yield string tokens from the LLM stream. Uses secrets (e.g. OPENAI_API_KEY) if provided."""
    if system_prompt:
        messages = [{"role": "system", "content": system_prompt}, *messages]

    if not _LITELLM_AVAILABLE:
        # Return a deterministic mock for dev / CI without API keys
        mock_text = f"[Mock LLM response from {model}. Configure API keys for real responses.]"
        for word in mock_text.split():
            yield word + " "
            await asyncio.sleep(0)
        return

    api_key = _api_key_from_secrets(model, secrets)
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    if api_key:
        kwargs["api_key"] = api_key

    try:
        response = await litellm.acompletion(**kwargs)
        async for chunk in response:
            delta = chunk.choices[0].delta
            content = getattr(delta, "content", None)
            if content:
                yield content
    except Exception as exc:
        log.warning("llm_call_failed", model=model, error=str(exc))
        _raise_friendly_if_auth_error(exc)


async def call_llm(
    *,
    model: str,
    messages: list[dict[str, Any]],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    system_prompt: str | None = None,
    secrets: dict[str, str] | None = None,
) -> str:
    """Collect full LLM response (non-streaming). Uses secrets if provided."""
    tokens: list[str] = []
    async for token in stream_llm_tokens(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        system_prompt=system_prompt,
        secrets=secrets,
    ):
        tokens.append(token)
    return "".join(tokens)


def get_embedding(
    text: str,
    model: str = "text-embedding-3-small",
    api_key: str | None = None,
    secrets: dict[str, str] | None = None,
) -> list[float]:
    """Return embedding vector synchronously. Uses api_key or secrets if provided."""
    if not _LITELLM_AVAILABLE:
        return [0.0] * 1536

    key = api_key or (secrets and _api_key_from_secrets(model, secrets))
    kwargs: dict[str, Any] = {"model": model, "input": [text]}
    if key:
        kwargs["api_key"] = key

    try:
        response = litellm.embedding(**kwargs)
        result: list[float] = response.data[0]["embedding"]
        return result
    except Exception as exc:
        log.warning("embedding_failed", model=model, error=str(exc))
        _raise_friendly_if_auth_error(exc)
