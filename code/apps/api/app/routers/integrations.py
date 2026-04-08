from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field

from app.core.auth import AuthUser, get_current_user
from app.services.integrations import IntegrationService

router = APIRouter()
service = IntegrationService()


class ConnectorResponse(BaseModel):
    key: str
    label: str
    description: str
    supports_trigger: bool
    supports_action: bool
    auth_required: bool
    sample_actions: list[str]


class ExecuteIntegrationRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)
    test_mode: bool = True


@router.get("/connectors", response_model=list[ConnectorResponse])
async def list_connectors(current_user: AuthUser = Depends(get_current_user)) -> list[ConnectorResponse]:
    _ = current_user
    return [ConnectorResponse(**item.__dict__) for item in service.list_connectors()]


@router.post("/{provider}/actions/{action}")
async def execute_connector_action(
    body: ExecuteIntegrationRequest,
    provider: str = Path(..., min_length=2, max_length=64, pattern=r"^[a-zA-Z0-9_\-]+$"),
    action: str = Path(..., min_length=2, max_length=128, pattern=r"^[a-zA-Z0-9_\-]+$"),
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    _ = current_user
    try:
        result = await service.execute(
            provider=provider,
            action=action,
            payload=body.payload,
            test_mode=body.test_mode,
        )
    except ValueError as exc:
        detail = str(exc)
        if "Unknown integration provider" in detail:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    return result

