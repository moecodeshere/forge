"""
Stripe billing service.
- Creates a Stripe Product + Price when a graph is published to the marketplace.
- Creates a Stripe Checkout Session for a buyer purchasing a listing.
- Free listings skip Stripe entirely.
"""
from __future__ import annotations

from typing import Any

import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

_STRIPE_AVAILABLE = False
try:
    import stripe  # type: ignore[import-untyped]

    _STRIPE_AVAILABLE = True
except ImportError:
    pass


def _get_stripe_client() -> Any:
    if not _STRIPE_AVAILABLE:
        raise RuntimeError("stripe package not installed")
    if not settings.STRIPE_SECRET_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def create_product_and_price(
    listing_id: str,
    title: str,
    description: str,
    price_cents: int,
) -> dict[str, str]:
    """
    Create a Stripe Product + one-time Price.
    Returns {"product_id": ..., "price_id": ...}.
    Free listings (price_cents == 0) return empty IDs.
    """
    if price_cents == 0:
        return {"product_id": "", "price_id": ""}

    stripe = _get_stripe_client()

    product = stripe.Product.create(
        name=title,
        description=description[:500],
        metadata={"forge_listing_id": listing_id},
    )
    price = stripe.Price.create(
        product=product["id"],
        unit_amount=price_cents,
        currency="usd",
        metadata={"forge_listing_id": listing_id},
    )
    log.info("stripe_product_created", product_id=product["id"], listing_id=listing_id)
    return {"product_id": product["id"], "price_id": price["id"]}


def create_checkout_session(
    listing_id: str,
    price_id: str,
    buyer_email: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """Create a Checkout Session and return the URL."""
    stripe = _get_stripe_client()

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="payment",
        customer_email=buyer_email,
        metadata={"forge_listing_id": listing_id},
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return str(session["url"])
