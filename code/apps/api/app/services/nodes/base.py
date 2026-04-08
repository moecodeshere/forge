"""
Node plugin base types.
Defines the NodePlugin contract and ExecutionContext for plugin execution.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    import redis.asyncio as aioredis


@dataclass
class NodePluginMeta:
    """Metadata for a node plugin."""

    type: str
    category: str  # triggers | ai | actions | data | logic | flow | human
    label: str
    description: str
    inputs: list[str]
    outputs: list[str]
    config_schema: dict[str, Any]
    ui_schema: dict[str, Any] | None = None


@dataclass
class ExecutionContext:
    """Context passed to plugin.execute()."""

    run_id: str
    redis: "aioredis.Redis"
    graph_content: dict[str, Any]
    publish: Callable[[Any], Awaitable[None]]
    """Async callable to publish ExecutionEvent to Redis."""


class NodePlugin(Protocol):
    """Protocol for node plugins."""

    meta: NodePluginMeta

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any] | tuple[dict[str, Any], str | None]:
        """
        Execute the node. Returns output dict, or (output, branch_override) for branch nodes.
        branch_override is the target node ID to follow (skipping other branches).
        """
        ...
