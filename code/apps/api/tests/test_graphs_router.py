from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import AuthUser, get_current_user
from app.main import app


class _FakeQueryResult:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _FakeGraphsTable:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self._filters: dict[str, Any] = {}
        self._insert_payload: dict[str, Any] | None = None
        self._update_payload: dict[str, Any] | None = None
        self._delete = False

    def select(self, _expr: str) -> "_FakeGraphsTable":
        return self

    def order(self, _col: str, desc: bool = False) -> "_FakeGraphsTable":
        self.rows.sort(key=lambda r: r["updated_at"], reverse=desc)
        return self

    def range(self, start: int, end: int) -> "_FakeGraphsTable":
        self.rows = self.rows[start : end + 1]
        return self

    def eq(self, col: str, value: Any) -> "_FakeGraphsTable":
        self._filters[col] = value
        return self

    def limit(self, _value: int) -> "_FakeGraphsTable":
        return self

    def insert(self, payload: dict[str, Any]) -> "_FakeGraphsTable":
        self._insert_payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> "_FakeGraphsTable":
        self._update_payload = payload
        return self

    def delete(self) -> "_FakeGraphsTable":
        self._delete = True
        return self

    def execute(self) -> _FakeQueryResult:
        if self._insert_payload is not None:
            row = {
                "id": str(uuid4()),
                "created_at": "2026-03-01T10:00:00+00:00",
                "updated_at": "2026-03-01T10:00:00+00:00",
                "version": 1,
                "is_public": False,
                **self._insert_payload,
            }
            self.rows.append(row)
            return _FakeQueryResult([row])

        filtered = [
            r for r in self.rows if all(r.get(col) == value for col, value in self._filters.items())
        ]

        if self._update_payload is not None:
            for row in filtered:
                row.update(self._update_payload)
            return _FakeQueryResult(filtered)

        if self._delete:
            for row in filtered:
                self.rows.remove(row)
            return _FakeQueryResult(filtered)

        return _FakeQueryResult(filtered)


class _FakeSupabaseClient:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def table(self, _name: str) -> _FakeGraphsTable:
        return _FakeGraphsTable(self.rows)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncClient:
    from app.routers import graphs as graphs_router

    rows = [
        {
            "id": str(uuid4()),
            "user_id": "2f2be583-6b0a-4ea8-ab2b-7c478ef5c27d",
            "title": "Existing Graph",
            "description": "desc",
            "content": {"version": 1, "nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}},
            "version": 1,
            "is_public": False,
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
        graphs_router,
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
async def test_list_graphs(client: AsyncClient) -> None:
    response = await client.get("/graphs")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 1
    assert payload["items"][0]["json_content"]["version"] == 1


@pytest.mark.asyncio
async def test_create_graph_success(client: AsyncClient) -> None:
    response = await client.post(
        "/graphs",
        json={
            "title": "New Graph",
            "json_content": {
                "version": 1,
                "nodes": [{"id": "a"}, {"id": "b"}],
                "edges": [{"source": "a", "target": "b"}],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            },
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "New Graph"
    assert body["json_content"]["nodes"][0]["id"] == "a"


@pytest.mark.asyncio
async def test_create_graph_empty_allowed(client: AsyncClient) -> None:
    """Empty graph (New Graph before adding nodes) should be valid."""
    response = await client.post(
        "/graphs",
        json={
            "title": "Blank Workflow",
            "json_content": {
                "version": 1,
                "nodes": [],
                "edges": [],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            },
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Blank Workflow"
    assert body["json_content"]["nodes"] == []


@pytest.mark.asyncio
async def test_create_graph_cycle_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/graphs",
        json={
            "title": "Bad Graph",
            "json_content": {
                "version": 1,
                "nodes": [{"id": "a"}, {"id": "b"}],
                "edges": [{"source": "a", "target": "b"}, {"source": "b", "target": "a"}],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            },
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_graphs_falls_back_when_content_missing(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.routers import graphs as graphs_router

    rows = [
        {
            "id": str(uuid4()),
            "user_id": "2f2be583-6b0a-4ea8-ab2b-7c478ef5c27d",
            "title": "Legacy Row",
            "description": None,
            "version": 1,
            "is_public": False,
            "created_at": "2026-03-01T10:00:00+00:00",
            "updated_at": "2026-03-01T10:00:00+00:00",
        }
    ]
    monkeypatch.setattr(
        graphs_router,
        "get_supabase_admin_client",
        lambda: _FakeSupabaseClient(rows),
    )

    response = await client.get("/graphs")
    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["json_content"]["nodes"] == []
