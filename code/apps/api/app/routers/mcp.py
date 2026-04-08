"""
MCP registry search and manifest endpoints.
GET  /mcp/search?q=...      — search public MCP registry (cached 5 min)
GET  /mcp/manifest?url=...  — fetch & cache server manifest (1 h)
"""
from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import AuthUser, get_current_user
from app.services.mcp_gateway import fetch_manifest, search_tools

router = APIRouter()
log = structlog.get_logger(__name__)


@router.get("/search")
async def search_mcp(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(default=20, ge=1, le=50),
    _user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    results = await search_tools(q, limit=limit)
    return {"results": results, "count": len(results)}


@router.get("/manifest")
async def get_manifest(
    url: str = Query(...),
    _user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="url must be an absolute HTTP(S) URL")
    manifest = await fetch_manifest(url)
    return manifest
