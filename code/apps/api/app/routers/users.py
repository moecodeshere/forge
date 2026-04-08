from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.auth import AuthUser, get_current_user
from app.services.supabase import get_supabase_admin_client
from app.services.user_keys import save_keys

router = APIRouter()


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    email: EmailStr
    role: str
    full_name: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime


class UserProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=2048)


def _to_profile(data: dict[str, Any]) -> UserProfileResponse:
    return UserProfileResponse(**data)


@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: AuthUser = Depends(get_current_user)) -> UserProfileResponse:
    client = get_supabase_admin_client()
    result = client.table("users").select("*").eq("id", current_user.id).limit(1).execute()
    rows = result.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )
    row = rows[0]
    return _to_profile(row)


@router.patch("/me", response_model=UserProfileResponse)
async def update_me(
    payload: UserProfileUpdateRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> UserProfileResponse:
    update_payload = payload.model_dump(exclude_unset=True)
    if not update_payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update",
        )

    client = get_supabase_admin_client()
    result = (
        client.table("users")
        .update(update_payload)
        .eq("id", current_user.id)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )
    row = rows[0]
    return _to_profile(row)


class SaveKeysRequest(BaseModel):
    """API keys from Run settings; stored encrypted server-side."""

    keys: dict[str, str] = Field(default_factory=dict, description="e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY")


@router.post("/me/keys", status_code=status.HTTP_204_NO_CONTENT)
async def save_my_keys(
    payload: SaveKeysRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> None:
    """Save API keys for the current user (encrypted). Enables Run without re-entering keys."""
    if not payload.keys:
        return
    save_keys(current_user.id, payload.keys)
