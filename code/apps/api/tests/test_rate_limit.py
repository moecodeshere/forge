from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core import rate_limit


class _FakePipeline:
    def __init__(self, count: int) -> None:
        self.count = count

    def zremrangebyscore(self, _key: str, _start: str, _end: float) -> "_FakePipeline":
        return self

    def zadd(self, _key: str, _mapping: dict[str, float]) -> "_FakePipeline":
        return self

    def zcard(self, _key: str) -> "_FakePipeline":
        return self

    def expire(self, _key: str, _ttl: int) -> "_FakePipeline":
        return self

    async def execute(self) -> list[object]:
        return [0, 1, self.count, True]


class _FakeRedis:
    def __init__(self, count: int) -> None:
        self.count = count

    def pipeline(self) -> _FakePipeline:
        return _FakePipeline(self.count)

    async def aclose(self) -> None:
        return None


@pytest.mark.asyncio
async def test_check_rate_limit_allows_when_under_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_get_redis() -> _FakeRedis:
        return _FakeRedis(count=5)

    monkeypatch.setattr(rate_limit, "_get_redis", _fake_get_redis)
    await rate_limit.check_rate_limit(
        "user-1",
        key_prefix="api",
        max_requests=10,
        window_seconds=60,
    )


@pytest.mark.asyncio
async def test_check_rate_limit_blocks_when_over_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_get_redis() -> _FakeRedis:
        return _FakeRedis(count=11)

    monkeypatch.setattr(rate_limit, "_get_redis", _fake_get_redis)
    with pytest.raises(HTTPException) as exc:
        await rate_limit.check_rate_limit(
            "user-1",
            key_prefix="api",
            max_requests=10,
            window_seconds=60,
        )
    assert exc.value.status_code == 429

