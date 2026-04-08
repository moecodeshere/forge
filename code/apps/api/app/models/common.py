"""Shared Pydantic base models used across the API."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TimestampedModel(BaseModel):
    """Base model with created_at / updated_at timestamps."""

    model_config = ConfigDict(from_attributes=True)

    created_at: datetime
    updated_at: datetime | None = None


class UUIDModel(BaseModel):
    """Base model with a UUID primary key."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID


class PaginatedResponse[T](BaseModel):
    """Generic paginated list wrapper."""

    items: list[T]
    total: int
    page: int
    page_size: int
    has_next: bool
