import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


@pytest.mark.asyncio
async def test_health_check_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/healthz")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_readiness_check_returns_ready(client: AsyncClient) -> None:
    response = await client.get("/readyz")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ready", "degraded")
    assert "checks" in data


@pytest.mark.asyncio
async def test_docs_available_in_dev(client: AsyncClient) -> None:
    response = await client.get("/docs")
    # In dev environment, docs should be accessible (200 or redirect)
    assert response.status_code in (200, 307)


@pytest.mark.asyncio
async def test_unknown_route_returns_404(client: AsyncClient) -> None:
    response = await client.get("/this-does-not-exist")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_metrics_endpoint_exposes_payload(client: AsyncClient) -> None:
    response = await client.get("/metrics")
    assert response.status_code == 200
    assert response.text
