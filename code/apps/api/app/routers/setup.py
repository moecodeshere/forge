"""
Setup endpoints for one-click RAG initialization.
"""
from __future__ import annotations

from pathlib import Path

import asyncpg
import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import AuthUser, get_current_user

router = APIRouter()
log = structlog.get_logger(__name__)


class InitRagRequest(BaseModel):
    """Request to initialize RAG tables and functions."""

    database_url: str = Field(
        ...,
        description="PostgreSQL connection string from Supabase (Project Settings → Database). Used only for this request, never stored.",
    )


@router.post("/init-rag", status_code=status.HTTP_200_OK)
async def init_rag(
    body: InitRagRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, str]:
    """
    Initialize RAG: create documents table and match_documents RPCs.
    Requires your Supabase database connection string (Project Settings → Database).
    The URL is used only for this request and never stored.
    """
    migration_path = Path(__file__).resolve().parent.parent.parent.parent / "supabase" / "migrations" / "003_documents.sql"
    if not migration_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Migration file not found",
        )
    sql = migration_path.read_text()

    try:
        conn = await asyncpg.connect(body.database_url)
        try:
            await conn.execute(sql)
            log.info("rag_init_success", user_id=current_user.id)
            return {"status": "success", "message": "RAG database initialized."}
        finally:
            await conn.close()
    except asyncpg.PostgresError as e:
        log.warning("rag_init_failed", user_id=current_user.id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database error: {e}",
        )
    except Exception as e:
        log.warning("rag_init_failed", user_id=current_user.id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect or run migration: {e}",
        )
