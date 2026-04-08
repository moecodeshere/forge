"""
Marketplace endpoints.
GET    /marketplace/search               — full-text search listings
GET    /marketplace                      — list public listings (paginated)
POST   /marketplace                      — publish a graph
GET    /marketplace/{id}                 — get listing detail
POST   /marketplace/{id}/purchase        — start Stripe checkout
POST   /marketplace/{id}/install         — install (clone) to buyer's graphs
DELETE /marketplace/{id}                 — unpublish (author only)
"""
from __future__ import annotations

from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import AuthUser, get_current_user
from app.services.billing import create_checkout_session, create_product_and_price
from app.services.supabase import get_supabase_admin_client

router = APIRouter()
log = structlog.get_logger(__name__)


class PublishRequest(BaseModel):
    graph_id: str
    title: str = Field(min_length=3, max_length=100)
    description: str = Field(max_length=2000)
    price_cents: int = Field(default=0, ge=0)
    category: str = Field(default="general", max_length=50)
    tags: list[str] = Field(default_factory=list)


class PurchaseRequest(BaseModel):
    success_url: str
    cancel_url: str


@router.get("/search")
async def search_listings(
    q: str = Query(..., min_length=1, max_length=200),
    category: str | None = Query(default=None),
    max_price: int | None = Query(default=None, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    supabase = get_supabase_admin_client()
    query = (
        supabase.table("marketplace_listings")
        .select("*")
        .eq("is_published", True)
        .text_search("search_vector", q)
    )
    if category:
        query = query.eq("category", category)
    if max_price is not None:
        query = query.lte("price_cents", max_price)

    resp = query.range(offset, offset + limit - 1).execute()
    return {"results": resp.data or [], "count": len(resp.data or [])}


@router.get("")
async def list_listings(
    category: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    supabase = get_supabase_admin_client()
    query = supabase.table("marketplace_listings").select("*").eq("is_published", True)
    if category:
        query = query.eq("category", category)
    resp = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"results": resp.data or [], "count": len(resp.data or [])}


@router.post("", status_code=status.HTTP_201_CREATED)
async def publish_listing(
    body: PublishRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    supabase = get_supabase_admin_client()

    # Verify graph ownership
    graph_resp = (
        supabase.table("graphs")
        .select("id, title, content")
        .eq("id", body.graph_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not graph_resp.data:
        raise HTTPException(status_code=404, detail="Graph not found")

    # Create Stripe product if paid
    stripe_ids: dict[str, str] = {"product_id": "", "price_id": ""}
    listing_id = str(uuid4())
    if body.price_cents > 0:
        try:
            stripe_ids = create_product_and_price(
                listing_id=listing_id,
                title=body.title,
                description=body.description,
                price_cents=body.price_cents,
            )
        except Exception as exc:
            log.warning("stripe_product_creation_failed", error=str(exc))

    row = {
        "id": listing_id,
        "graph_id": body.graph_id,
        "author_id": current_user.id,
        "title": body.title,
        "description": body.description,
        "price_cents": body.price_cents,
        "category": body.category,
        "tags": body.tags,
        "stripe_product_id": stripe_ids["product_id"],
        "stripe_price_id": stripe_ids["price_id"],
        "is_published": True,
    }
    supabase.table("marketplace_listings").insert(row).execute()
    return {"listing_id": listing_id}


@router.get("/{listing_id}")
async def get_listing(listing_id: str) -> dict[str, Any]:
    supabase = get_supabase_admin_client()
    resp = (
        supabase.table("marketplace_listings")
        .select("*")
        .eq("id", listing_id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    return resp.data


@router.post("/{listing_id}/purchase")
async def purchase_listing(
    listing_id: str,
    body: PurchaseRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    supabase = get_supabase_admin_client()
    listing_resp = (
        supabase.table("marketplace_listings")
        .select("*")
        .eq("id", listing_id)
        .eq("is_published", True)
        .maybe_single()
        .execute()
    )
    if not listing_resp.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing = listing_resp.data

    if listing["price_cents"] == 0:
        # Free — install immediately
        return await _install(listing_id=listing_id, buyer_id=current_user.id, supabase=supabase)

    if not listing.get("stripe_price_id"):
        raise HTTPException(status_code=422, detail="Paid listing missing Stripe price")

    url = create_checkout_session(
        listing_id=listing_id,
        price_id=listing["stripe_price_id"],
        buyer_email=current_user.email or "",
        success_url=body.success_url,
        cancel_url=body.cancel_url,
    )
    return {"checkout_url": url}


@router.post("/{listing_id}/install", status_code=status.HTTP_201_CREATED)
async def install_listing(
    listing_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    supabase = get_supabase_admin_client()
    return await _install(listing_id=listing_id, buyer_id=current_user.id, supabase=supabase)


async def _install(listing_id: str, buyer_id: str, supabase: Any) -> dict[str, Any]:
    """Clone graph JSON to buyer's account with attribution."""
    listing_resp = (
        supabase.table("marketplace_listings")
        .select("*, graphs(title, content, user_id)")
        .eq("id", listing_id)
        .maybe_single()
        .execute()
    )
    if not listing_resp.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing = listing_resp.data
    source_graph = listing.get("graphs") or {}

    new_graph_id = str(uuid4())
    supabase.table("graphs").insert(
        {
            "id": new_graph_id,
            "user_id": buyer_id,
            "title": f"{listing['title']} (from marketplace)",
            "content": source_graph.get("content", {"nodes": [], "edges": []}),
            "original_listing_id": listing_id,
            "original_author_id": listing.get("author_id"),
        }
    ).execute()

    supabase.table("purchases").insert(
        {
            "listing_id": listing_id,
            "buyer_id": buyer_id,
            "cloned_graph_id": new_graph_id,
        }
    ).execute()

    return {"graph_id": new_graph_id}


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unpublish_listing(
    listing_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> None:
    supabase = get_supabase_admin_client()
    resp = (
        supabase.table("marketplace_listings")
        .select("id, author_id")
        .eq("id", listing_id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    if resp.data["author_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not the author")
    supabase.table("marketplace_listings").update({"is_published": False}).eq(
        "id", listing_id
    ).execute()
