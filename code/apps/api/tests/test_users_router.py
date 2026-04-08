from __future__ import annotations

from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import AuthUser, get_current_user
from app.main import app


class _FakeQueryResult:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _FakeTableQuery:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.current_id: str | None = None
        self.update_payload: dict[str, Any] | None = None

    def select(self, _: str) -> "_FakeTableQuery":
        return self

    def eq(self, _column: str, value: str) -> "_FakeTableQuery":
        self.current_id = value
        return self

    def limit(self, _value: int) -> "_FakeTableQuery":
        return self

    def update(self, payload: dict[str, Any]) -> "_FakeTableQuery":
        self.update_payload = payload
        return self

    def execute(self) -> _FakeQueryResult:
        if self.current_id is None:
            return _FakeQueryResult([])

        row = next((r for r in self.rows if r["id"] == self.current_id), None)
        if row is None:
            return _FakeQueryResult([])

        if self.update_payload is not None:
            row.update(self.update_payload)
        return _FakeQueryResult([row])


class _FakeSupabaseClient:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def table(self, _name: str) -> _FakeTableQuery:
        return _FakeTableQuery(self.rows)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncClient:
    from app.routers import users as users_router

    rows = [
        {
            "id": "2f2be583-6b0a-4ea8-ab2b-7c478ef5c27d",
            "email": "user@example.com",
            "role": "user",
            "full_name": "Test User",
            "avatar_url": None,
            "created_at": "2026-03-01T10:00:00+00:00",
            "updated_at": "2026-03-01T10:00:00+00:00",
        }
    ]

    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        id="2f2be583-6b0a-4ea8-ab2b-7c478ef5c27d",
        email="user@example.com",
        role="authenticated",
        raw_claims={},
    )
    monkeypatch.setattr(
        users_router,
        "get_supabase_admin_client",
        lambda: _FakeSupabaseClient(rows),
    )

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient) -> None:
    response = await client.get("/users/me")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "user@example.com"
    assert body["full_name"] == "Test User"


@pytest.mark.asyncio
async def test_patch_me_updates_profile(client: AsyncClient) -> None:
    response = await client.patch("/users/me", json={"full_name": "Updated Name"})

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_patch_me_rejects_empty_payload(client: AsyncClient) -> None:
    response = await client.patch("/users/me", json={})

    assert response.status_code == 400
    assert response.json()["detail"] == "No fields provided for update"
