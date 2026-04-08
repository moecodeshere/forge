from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.monitoring import record_error, record_request
from app.routers import (
    ai_builder,
    deployments,
    executions,
    graphs,
    health,
    integrations,
    marketplace,
    mcp,
    nodes,
    setup,
    users,
    webhooks,
)

configure_logging(settings.LOG_LEVEL)

# Sentry (gracefully no-ops when SDK not installed or DSN not set)
try:
    import sentry_sdk  # type: ignore[import-untyped]
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1,
            integrations=[StarletteIntegration(), FastApiIntegration()],
        )
except ImportError:
    pass
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "forge_api_starting",
        version="0.0.1",
        environment=settings.ENVIRONMENT,
    )
    yield
    logger.info("forge_api_stopping")


app = FastAPI(
    title="Forge API",
    description="Forge AI Workflow Studio — Backend API",
    version="0.0.1",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next: object) -> JSONResponse:
    import time

    start = time.perf_counter()
    try:
        response = await call_next(request)  # type: ignore[operator]
    except Exception:
        elapsed_s = time.perf_counter() - start
        record_request(request.method, request.url.path, 500, elapsed_s)
        record_error("unhandled_exception")
        raise
    elapsed_s = time.perf_counter() - start
    elapsed_ms = round(elapsed_s * 1000, 2)
    record_request(request.method, request.url.path, response.status_code, elapsed_s)
    if response.status_code >= 500:
        record_error("http_5xx")

    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        elapsed_ms=elapsed_ms,
    )
    return response  # type: ignore[return-value]


app.include_router(health.router, tags=["health"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(graphs.router, prefix="/graphs", tags=["graphs"])
app.include_router(executions.router, prefix="/executions", tags=["executions"])
app.include_router(nodes.router, prefix="/nodes", tags=["nodes"])
app.include_router(deployments.router, prefix="/deployments", tags=["deployments"])
app.include_router(marketplace.router, prefix="/marketplace", tags=["marketplace"])
app.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
app.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
app.include_router(ai_builder.router, prefix="/ai-builder", tags=["ai-builder"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
app.include_router(setup.router, prefix="/setup", tags=["setup"])
