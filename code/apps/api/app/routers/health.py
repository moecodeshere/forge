from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
import redis.asyncio as aioredis

from app.core.config import settings
from app.core.monitoring import get_metrics_response
from app.services.supabase import get_supabase_admin_client

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str


class ReadinessResponse(BaseModel):
    status: str
    checks: dict[str, str]


@router.get("/healthz", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Liveness probe — confirms the process is running."""
    return HealthResponse(status="ok", version="0.0.1")


async def _check_database() -> str:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return "skipped"
    try:
        supabase = get_supabase_admin_client()
        supabase.table("graph_runs").select("id").limit(1).execute()
        return "ok"
    except Exception:
        return "error"


async def _check_redis() -> str:
    try:
        redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis.ping()
        await redis.aclose()
        return "ok"
    except Exception:
        return "error"


@router.get("/readyz", response_model=ReadinessResponse)
async def readiness_check() -> ReadinessResponse:
    """Readiness probe — confirms dependencies are reachable."""
    db_status = await _check_database()
    redis_status = await _check_redis()

    checks: dict[str, str] = {
        "database": db_status,
        "redis": redis_status,
    }

    # Ready if all required checks are ok; skipped checks don't block readiness
    required_ok = all(v in ("ok", "skipped") for v in checks.values())
    overall = "ready" if required_ok else "degraded"
    return ReadinessResponse(status=overall, checks=checks)


@router.get("/metrics", include_in_schema=False)
async def prometheus_metrics() -> Response:
    """Prometheus scrape endpoint."""
    body, content_type = get_metrics_response()
    return Response(content=body, media_type=content_type)
