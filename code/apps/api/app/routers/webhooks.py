"""
Webhook handlers.
POST /webhooks/stripe    — Stripe checkout events
POST /webhooks/workflow/{graph_id} — Start workflow via webhook
"""
from __future__ import annotations

import json
from typing import Any
from uuid import uuid4
from datetime import datetime

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status

from app.core.config import settings
from app.models.execution import ExecutionStatus
from app.services.supabase import get_supabase_admin_client
from app.workers.execution_workflow import start_workflow

router = APIRouter()
log = structlog.get_logger(__name__)

@router.post("/workflow/{graph_id}", status_code=status.HTTP_202_ACCEPTED)
async def workflow_webhook(
    request: Request,
    graph_id: str,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    """
    Start a workflow via webhook. Pass JSON body as input_data.
    If FORGE_WEBHOOK_SECRET is set, include X-Webhook-Secret header.
    """
    if settings.FORGE_WEBHOOK_SECRET:
        secret = request.headers.get("X-Webhook-Secret", "")
        if secret != settings.FORGE_WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        body = await request.json()
    except Exception:
        body = {}

    headers_dict = dict(request.headers) if request.headers else {}
    input_data: dict[str, Any] = {
        "body": body,
        "headers": {k: v for k, v in headers_dict.items() if k.lower() not in ("authorization", "cookie")},
    }

    supabase = get_supabase_admin_client()
    row = (
        supabase.table("graphs")
        .select("id, content, user_id")
        .eq("id", graph_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Graph not found")

    graph_content = row.data.get("content") or {}
    if not graph_content.get("nodes"):
        raise HTTPException(status_code=422, detail="Graph has no nodes")

    user_id = row.data["user_id"]
    run_id = str(uuid4())
    supabase.table("graph_runs").insert(
        {
            "id": run_id,
            "user_id": user_id,
            "graph_id": graph_id,
            "status": ExecutionStatus.PENDING.value,
            "input": input_data,
            "started_at": datetime.utcnow().isoformat(),
        }
    ).execute()

    background_tasks.add_task(
        start_workflow,
        run_id=run_id,
        user_id=user_id,
        graph_id=graph_id,
        graph_content=graph_content,
        input_data=input_data,
        temporal_host=settings.TEMPORAL_HOST,
    )
    log.info("workflow_webhook_triggered", graph_id=graph_id, run_id=run_id)
    return {"run_id": run_id, "status": "accepted"}


_STRIPE_AVAILABLE = False
try:
    import stripe as stripe_lib  # type: ignore[import-untyped]

    _STRIPE_AVAILABLE = True
except ImportError:
    pass


@router.post("/stripe", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request) -> dict[str, str]:
    if not _STRIPE_AVAILABLE:
        raise HTTPException(status_code=501, detail="Stripe not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe_lib.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe_lib.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    event_id: str = event["id"]
    event_type: str = event["type"]

    supabase = get_supabase_admin_client()

    # Idempotency — skip already-processed events
    existing = (
        supabase.table("stripe_events")
        .select("id")
        .eq("stripe_event_id", event_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        log.info("stripe_event_already_processed", event_id=event_id)
        return {"status": "already_processed"}

    supabase.table("stripe_events").insert({"stripe_event_id": event_id, "type": event_type}).execute()

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(event["data"]["object"], supabase)

    log.info("stripe_webhook_processed", event_id=event_id, type=event_type)
    return {"status": "ok"}


def _handle_checkout_completed(session: dict[str, Any], supabase: Any) -> None:
    listing_id = session.get("metadata", {}).get("forge_listing_id")
    buyer_email: str = session.get("customer_email", "")

    if not listing_id:
        return

    # Look up buyer by email
    user_resp = (
        supabase.table("users").select("id").eq("email", buyer_email).maybe_single().execute()
    )
    if not user_resp.data:
        log.warning("stripe_buyer_not_found", email=buyer_email)
        return

    buyer_id: str = user_resp.data["id"]

    # Record purchase and clone graph
    from app.routers.marketplace import _install
    import asyncio

    try:
        asyncio.get_event_loop().run_until_complete(
            _install(listing_id=listing_id, buyer_id=buyer_id, supabase=supabase)
        )
        log.info("checkout_install_complete", listing_id=listing_id, buyer_id=buyer_id)
    except Exception as exc:
        log.error("checkout_install_failed", listing_id=listing_id, error=str(exc))
