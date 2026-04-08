from __future__ import annotations

from app.core import monitoring


def test_metrics_response_contains_prometheus_or_fallback() -> None:
    body, content_type = monitoring.get_metrics_response()
    assert isinstance(body, bytes)
    assert isinstance(content_type, str)
    if b"prometheus_client not installed" in body:
        assert content_type == "text/plain"
    else:
        assert "text/plain" in content_type


def test_monitoring_recorders_do_not_raise() -> None:
    monitoring.record_request("GET", "/healthz", 200, 0.015)
    monitoring.record_execution("graph-1", "completed", 0.5)
    monitoring.record_error("test_error")
    monitoring.increment_ws()
    monitoring.decrement_ws()

