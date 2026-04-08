"""
Nodes API.
GET /nodes — list available node plugins for palette and config UI.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.services.nodes import list_plugins

router = APIRouter()


@router.get("", status_code=200)
async def list_nodes() -> list[dict]:
    """Return metadata for all registered node plugins."""
    return list_plugins()
