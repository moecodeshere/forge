"""
Simple LLM node plugin.
User-friendly AI node: model, prompt, temperature. Uses LLM streaming.
Optionally supports RAG and tools (future).
"""
from __future__ import annotations

import json
from typing import Any

from app.models.execution import EventType, ExecutionEvent
from app.services.expressions import evaluate_expression
from app.services.llm_caller import stream_llm_tokens
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class SimpleLLMPlugin:
    meta = NodePluginMeta(
        type="simple_llm",
        category="ai",
        label="Simple LLM",
        description="Call an LLM with a prompt. Supports expression references.",
        inputs=["prompt", "context"],
        outputs=["output", "token_count"],
        config_schema={
            "type": "object",
            "properties": {
                "model": {"type": "string", "default": "gpt-4o-mini"},
                "prompt": {"type": "string"},
                "system_prompt": {"type": "string"},
                "temperature": {"type": "number", "default": 0.7},
                "max_tokens": {"type": "integer", "default": 2048},
            },
        },
        ui_schema={
            "model": {"widget": "select", "placeholder": "gpt-4o-mini"},
            "prompt": {
                "widget": "textarea",
                "placeholder": "Use {{input.query}} for dynamic values",
            },
            "system_prompt": {"widget": "textarea"},
            "temperature": {"widget": "number", "min": 0, "max": 1, "step": 0.1},
            "max_tokens": {"widget": "number", "min": 1, "max": 8192},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        model = cfg.get("model", "gpt-4o-mini")
        system_prompt = cfg.get("system_prompt", "")
        temperature = float(cfg.get("temperature", 0.7))
        max_tokens = int(cfg.get("max_tokens", 2048))

        expr_context = {
            "input": state.get("_input", {}),
            **_build_node_context(state.get("_node_outputs", {})),
        }
        prompt_raw = cfg.get("prompt", "")
        if prompt_raw:
            user_content = (
                evaluate_expression(prompt_raw, expr_context)
                if isinstance(prompt_raw, str)
                else str(prompt_raw)
            )
        else:
            user_content = json.dumps(state.get("_input", {}))

        messages = [{"role": "user", "content": user_content}]

        secrets = state.get("_secrets") or {}
        if not isinstance(secrets, dict):
            secrets = {}

        token_count = 0
        response_parts: list[str] = []

        async for token in stream_llm_tokens(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=system_prompt,
            secrets=secrets,
        ):
            response_parts.append(token)
            token_count += 1
            await context.publish(
                ExecutionEvent(
                    event_type=EventType.TOKEN,
                    run_id=context.run_id,
                    node_id=node["id"],
                    data={"token": token, "token_count": token_count},
                )
            )

        return {"output": "".join(response_parts), "token_count": token_count}


def _build_node_context(node_outputs: dict[str, Any]) -> dict[str, Any]:
    return node_outputs


register(SimpleLLMPlugin())
