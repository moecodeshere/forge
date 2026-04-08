"""
Audit log service — thin wrapper around Supabase inserts.
Called from all mutation endpoints (graph CRUD, deploy, marketplace, purchase).
Fire-and-forget; errors are logged but not re-raised.
"""
from __future__ import annotations

from typing import Any

import structlog

from app.services.supabase import get_supabase_admin_client

log = structlog.get_logger(__name__)


def log_action(
    *,
    user_id: str | None,
    entity_type: str,
    entity_id: str,
    action: str,
    metadata: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Write an audit log entry. Never raises."""
    try:
        supabase = get_supabase_admin_client()
        row: dict[str, Any] = {
            "user_id": user_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "metadata": metadata or {},
        }
        if ip_address:
            row["ip_address"] = ip_address
        if user_agent:
            row["user_agent"] = user_agent
        supabase.table("audit_logs").insert(row).execute()
    except Exception as exc:
        log.warning("audit_log_write_failed", action=action, entity_id=entity_id, error=str(exc))
