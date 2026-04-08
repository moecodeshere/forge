"""
Redis sliding-window rate limiter.
- 100 requests / minute per user (API)
- 10 concurrent executions per user

Usage (FastAPI dependency):
    @router.post(...)
    async def endpoint(
        _: None = Depends(rate_limit(requests=100, window=60)),
        current_user = Depends(get_current_user),
    ):
        ...
"""
from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

import redis.asyncio as aioredis
import structlog
from fastapi import Depends, HTTPException, Request, status

from app.core.auth import AuthUser, get_current_user
from app.core.config import settings

log = structlog.get_logger(__name__)

MAX_API_REQUESTS_PER_MINUTE = 100
MAX_CONCURRENT_EXECUTIONS = 10


async def _get_redis() -> aioredis.Redis:
    return await aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def check_rate_limit(
    user_id: str,
    *,
    key_prefix: str,
    max_requests: int,
    window_seconds: int,
) -> None:
    """
    Sliding-window rate check.  Raises 429 when limit is exceeded.
    Uses a Redis sorted set keyed by user_id; members are request timestamps.
    """
    redis = await _get_redis()
    now = time.time()
    window_start = now - window_seconds
    key = f"rl:{key_prefix}:{user_id}"

    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, "-inf", window_start)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds + 1)
    results = await pipe.execute()
    await redis.aclose()

    count: int = results[2]
    if count > max_requests:
        log.warning("rate_limit_exceeded", user_id=user_id, key=key_prefix, count=count)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit: max {max_requests} requests per {window_seconds}s",
            headers={"Retry-After": str(window_seconds)},
        )


def api_rate_limit(
    max_requests: int = MAX_API_REQUESTS_PER_MINUTE,
    window_seconds: int = 60,
) -> Callable[..., Any]:
    """FastAPI dependency factory for API rate limiting."""

    async def _check(current_user: AuthUser = Depends(get_current_user)) -> None:
        await check_rate_limit(
            current_user.id,
            key_prefix="api",
            max_requests=max_requests,
            window_seconds=window_seconds,
        )

    return _check


async def check_execution_concurrency(user_id: str) -> None:
    """Raise 429 if user has ≥ MAX_CONCURRENT_EXECUTIONS running."""
    from app.services.supabase import get_supabase_admin_client

    supabase = get_supabase_admin_client()
    resp = (
        supabase.table("graph_runs")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .in_("status", ["pending", "running"])
        .execute()
    )
    count: int = resp.count or 0
    if count >= MAX_CONCURRENT_EXECUTIONS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Max {MAX_CONCURRENT_EXECUTIONS} concurrent executions allowed",
        )
