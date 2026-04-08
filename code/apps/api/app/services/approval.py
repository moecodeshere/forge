"""
Human approval service.
Resolves in-memory asyncio gates created by the execution engine when
an ApprovalStep node is encountered.
Thin wrapper around execution.resolve_approval that logs to Supabase.
"""
from __future__ import annotations

from typing import Any

import structlog

from app.services.approval_gates import resolve_approval
from app.services.supabase import get_supabase_admin_client

log = structlog.get_logger(__name__)


def approve(
    run_id: str,
    *,
    approved: bool,
    feedback: str | None = None,
    reviewer_id: str | None = None,
) -> bool:
    """
    Approve or reject a paused execution.
    Writes audit record; returns False if no gate exists for run_id.
    """
    ok = resolve_approval(run_id, approved=approved, feedback=feedback)
    if ok:
        _log_approval(run_id, approved=approved, feedback=feedback, reviewer_id=reviewer_id)
    return ok


def _log_approval(
    run_id: str,
    *,
    approved: bool,
    feedback: str | None,
    reviewer_id: str | None,
) -> None:
    try:
        supabase = get_supabase_admin_client()
        supabase.table("audit_logs").insert(
            {
                "entity_type": "graph_run",
                "entity_id": run_id,
                "action": "approval_resolved",
                "user_id": reviewer_id,
                "metadata": {"approved": approved, "feedback": feedback},
            }
        ).execute()
    except Exception as exc:
        log.warning("approval_audit_write_failed", run_id=run_id, error=str(exc))
