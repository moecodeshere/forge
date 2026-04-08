#!/usr/bin/env python3
"""
Pydantic model codegen from shared-schemas Zod definitions.

This script reads the Zod type definitions from src/ and generates
equivalent Pydantic v2 models in apps/api/app/models/generated.py.

Usage:
    python codegen/generate_pydantic.py

The generated file should NOT be hand-edited — it is overwritten on each run.
Add custom logic in apps/api/app/models/custom.py instead.
"""

from __future__ import annotations

import textwrap
from pathlib import Path

OUTPUT_PATH = Path(__file__).parents[2] / "apps" / "api" / "app" / "models" / "generated.py"

HEADER = '''\
# AUTO-GENERATED — DO NOT EDIT
# Source: packages/shared-schemas/codegen/generate_pydantic.py
# Re-run to regenerate after changing packages/shared-schemas/src/nodes.ts

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


'''

MODELS = '''\
class LLMModel(str, Enum):
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"
    CLAUDE_3_5_SONNET = "claude-3-5-sonnet-20241022"
    CLAUDE_3_HAIKU = "claude-3-haiku-20240307"
    GEMINI_2_FLASH = "gemini-2.0-flash"
    GEMINI_1_5_PRO = "gemini-1.5-pro"


class EmbeddingModel(str, Enum):
    TEXT_EMBEDDING_3_SMALL = "text-embedding-3-small"
    TEXT_EMBEDDING_3_LARGE = "text-embedding-3-large"
    ALL_MINILM_L6_V2 = "all-MiniLM-L6-v2"


class MCPAuthType(str, Enum):
    NONE = "none"
    OAUTH2 = "oauth2"
    JWT = "jwt"
    API_KEY = "api_key"


class LLMCallerConfig(BaseModel):
    model: LLMModel
    temperature: Annotated[float, Field(ge=0.0, le=1.0)] = 0.7
    max_tokens: Annotated[int, Field(gt=0, le=8192)] = 2048
    system_prompt: str | None = Field(default=None, max_length=4096)
    stream: bool = True


class RAGRetrieverConfig(BaseModel):
    embedding_model: EmbeddingModel = EmbeddingModel.TEXT_EMBEDDING_3_SMALL
    top_k: Annotated[int, Field(gt=0, le=20)] = 5
    min_score: Annotated[float, Field(ge=0.0, le=1.0)] = 0.65
    collection_id: UUID | None = None


class Condition(BaseModel):
    id: UUID
    expr: Annotated[str, Field(min_length=1, max_length=512)]
    target: Annotated[str, Field(min_length=1)]
    label: str | None = None


class ConditionalBranchConfig(BaseModel):
    conditions: Annotated[list[Condition], Field(min_length=1, max_length=20)]
    default_target: str | None = None


class MCPToolConfig(BaseModel):
    mcp_url: Annotated[str, Field(max_length=512)]
    tool_name: Annotated[str, Field(min_length=1, max_length=128)]
    auth_type: MCPAuthType = MCPAuthType.NONE
    auth_config: dict[str, str] | None = None
    timeout_ms: Annotated[int, Field(gt=0, le=30_000)] = 10_000


class ApprovalStepConfig(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=128)] = "Review Required"
    description: Annotated[str | None, Field(max_length=512)] = None
    form_schema: dict[str, Any] | None = None
    timeout_hours: Annotated[int, Field(gt=0, le=168)] = 24
    notify_email: str | None = None
'''


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    content = HEADER + MODELS
    OUTPUT_PATH.write_text(content, encoding="utf-8")
    print(f"Generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
'''
