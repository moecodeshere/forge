"""
Prometheus metrics for Forge API.
Exposes /metrics endpoint (text/plain; version=0.0.4).

Metrics:
  forge_http_request_duration_seconds  — request latency histogram
  forge_execution_duration_seconds     — graph execution duration
  forge_errors_total                   — error counter by type
  forge_active_websockets              — active WS connections gauge
"""
from __future__ import annotations

from typing import Any

_PROMETHEUS_AVAILABLE = False
try:
    from prometheus_client import (  # type: ignore[import-untyped]
        CollectorRegistry,
        Counter,
        Gauge,
        Histogram,
        generate_latest,
        CONTENT_TYPE_LATEST,
    )

    _PROMETHEUS_AVAILABLE = True
except ImportError:
    pass

if _PROMETHEUS_AVAILABLE:
    REGISTRY = CollectorRegistry(auto_describe=True)

    HTTP_REQUEST_DURATION = Histogram(
        "forge_http_request_duration_seconds",
        "HTTP request latency",
        ["method", "path", "status_code"],
        registry=REGISTRY,
    )

    EXECUTION_DURATION = Histogram(
        "forge_execution_duration_seconds",
        "Graph execution duration",
        ["graph_id", "status"],
        registry=REGISTRY,
    )

    ERROR_COUNTER = Counter(
        "forge_errors_total",
        "Error count by type",
        ["error_type"],
        registry=REGISTRY,
    )

    ACTIVE_WS = Gauge(
        "forge_active_websockets",
        "Number of active WebSocket connections",
        registry=REGISTRY,
    )


def record_request(method: str, path: str, status_code: int, duration: float) -> None:
    if not _PROMETHEUS_AVAILABLE:
        return
    HTTP_REQUEST_DURATION.labels(
        method=method, path=path, status_code=str(status_code)
    ).observe(duration)


def record_execution(graph_id: str, status: str, duration: float) -> None:
    if not _PROMETHEUS_AVAILABLE:
        return
    EXECUTION_DURATION.labels(graph_id=graph_id, status=status).observe(duration)


def record_error(error_type: str) -> None:
    if not _PROMETHEUS_AVAILABLE:
        return
    ERROR_COUNTER.labels(error_type=error_type).inc()


def increment_ws() -> None:
    if _PROMETHEUS_AVAILABLE:
        ACTIVE_WS.inc()


def decrement_ws() -> None:
    if _PROMETHEUS_AVAILABLE:
        ACTIVE_WS.dec()


def get_metrics_response() -> tuple[bytes, str]:
    """Return (body, content_type) for the /metrics endpoint."""
    if not _PROMETHEUS_AVAILABLE:
        return b"# prometheus_client not installed\n", "text/plain"
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST
