from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth import AuthUser, get_current_user
from app.services.ai_builder import suggest_workflow_from_prompt
from app.services.audit import log_action

router = APIRouter()


class SuggestWorkflowRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)


class SuggestedGraphResponse(BaseModel):
    template_id: str | None = None
    template_name: str | None = None
    rationale: str
    parameters: dict[str, Any] | None = None
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


class SuggestionTelemetryEvent(BaseModel):
    event_type: Literal["applied", "regenerated"]
    template_id: str | None = None
    template_name: str | None = None
    prompt: str


@router.post("/suggest-workflow", response_model=SuggestedGraphResponse)
async def suggest_workflow(
    body: SuggestWorkflowRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> SuggestedGraphResponse:
    _ = current_user
    suggestion = suggest_workflow_from_prompt(body.prompt)
    return SuggestedGraphResponse(**suggestion)


@router.post("/suggest-workflow/telemetry", status_code=204)
async def log_suggestion_telemetry(
    body: SuggestionTelemetryEvent,
    current_user: AuthUser = Depends(get_current_user),
) -> None:
    """
    Optional telemetry endpoint to track how AI suggestions are used.

    Events are written to the audit log and never raise errors back to callers.
    """
    template_id = body.template_id or "unknown-template"
    metadata: dict[str, Any] = {
        "template_name": body.template_name,
        "prompt_length": len(body.prompt),
        "event_type": body.event_type,
    }
    log_action(
        user_id=current_user.id,
        entity_type="ai_suggestion",
        entity_id=template_id,
        action=body.event_type,
        metadata=metadata,
    )

