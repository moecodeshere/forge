"""
Wait for Callback node plugin.
Pauses the run and outputs a resume URL. When the URL is called (POST with optional body),
the run resumes from the next node with callback payload merged into state.
"""
from __future__ import annotations

import secrets as secmod
from typing import Any

from app.core.config import settings
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


def _resume_token_key(token: str) -> str:
    return f"forge:resume:{token}"


async def store_pause(run_id: str, node_id: str, token: str, redis) -> None:
    key = _resume_token_key(token)
    await redis.setex(key, 86400 * 7, f"{run_id}:{node_id}")  # 7 days


async def consume_resume_token(redis, token: str) -> tuple[str, str] | None:
    key = _resume_token_key(token)
    val = await redis.get(key)
    if not val:
        return None
    await redis.delete(key)
    parts = val.split(":", 1)
    if len(parts) != 2:
        return None
    return (parts[0], parts[1])


class WaitCallbackPlugin:
    meta = NodePluginMeta(
        type="wait_callback",
        category="flow",
        label="Wait for Callback",
        description="Pause the run and output a resume URL. Call it (POST) to continue with payload merged into state.",
        inputs=[],
        outputs=["resume_url", "resume_token", "resume_method"],
        config_schema={
            "type": "object",
            "properties": {
                "base_url": {"type": "string", "description": "Optional base URL for resume (default: API_PUBLIC_URL)"},
            },
        },
        ui_schema={"base_url": {"widget": "text"}},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        base = (cfg.get("base_url") or settings.API_PUBLIC_URL or "http://localhost:8000").strip().rstrip("/")
        token = secmod.token_urlsafe(32)
        await store_pause(context.run_id, node["id"], token, context.redis)
        resume_url = f"{base}/executions/resume?token={token}"
        return {
            "resume_url": resume_url,
            "resume_token": token,
            "resume_method": "POST",
            "__pause__": True,
        }


register(WaitCallbackPlugin())
