from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class NodeStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    PAUSED = "paused"
    SKIPPED = "skipped"


class EventType(str, Enum):
    NODE_STARTED = "node_started"
    TOKEN = "token"
    NODE_COMPLETED = "node_completed"
    NODE_FAILED = "node_failed"
    EXECUTION_COMPLETED = "execution_completed"
    EXECUTION_FAILED = "execution_failed"
    EXECUTION_CANCELLED = "execution_cancelled"
    APPROVAL_REQUIRED = "approval_required"
    CHECKPOINT_SAVED = "checkpoint_saved"


class ExecutionEvent(BaseModel):
    event_type: EventType
    run_id: str
    node_id: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StartExecutionRequest(BaseModel):
    graph_id: str
    input_data: dict[str, Any] = Field(default_factory=dict)
    secrets: dict[str, str] = Field(default_factory=dict)


class StartExecutionResponse(BaseModel):
    run_id: str
    status: ExecutionStatus


class ExecutionRunResponse(BaseModel):
    id: str
    graph_id: str
    user_id: str
    status: ExecutionStatus
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    error: str | None = None
    started_at: datetime
    completed_at: datetime | None = None


class ApproveStepRequest(BaseModel):
    approved: bool
    feedback: str | None = None
