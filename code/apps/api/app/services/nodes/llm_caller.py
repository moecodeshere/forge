"""
LLM Caller node plugin.
"""
from __future__ import annotations

import json
from typing import Any

from app.models.execution import EventType, ExecutionEvent
from app.services.llm_caller import stream_llm_tokens
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class LLMCallerPlugin:
    meta = NodePluginMeta(
        type="llm_caller",
        category="ai",
        label="LLM Caller",
        description="Call an LLM for text generation with streaming support.",
        inputs=["context"],
        outputs=["output", "token_count"],
        config_schema={
            "type": "object",
            "properties": {
                "model": {"type": "string", "default": "gpt-4o-mini"},
                "system_prompt": {"type": "string"},
                "temperature": {"type": "number", "default": 0.7},
                "max_tokens": {"type": "integer", "default": 2048},
                "prompt_chain": {
                    "type": "object",
                    "description": "Named multi-step chain: carry upstream fields into this prompt",
                    "properties": {
                        "id": {"type": "string"},
                        "step_index": {"type": "integer"},
                        "carry_keys": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
        },
        ui_schema={
            "model": {"widget": "select", "placeholder": "gpt-4o-mini"},
            "system_prompt": {"widget": "textarea", "placeholder": "System instructions"},
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

        merged_input = state.get("_input") or {}
        prompt_chain = cfg.get("prompt_chain")
        chain_prefix = ""
        if isinstance(prompt_chain, dict):
            cid = prompt_chain.get("id")
            step = prompt_chain.get("step_index")
            if cid is not None or step is not None:
                system_prompt = (
                    f"[Prompt chain {cid!s} · step {step!s}]\n" + (system_prompt or "")
                ).strip()
            carry_keys = prompt_chain.get("carry_keys")
            if isinstance(carry_keys, list) and carry_keys:
                lines: list[str] = []
                for k in carry_keys:
                    if not isinstance(k, str) or k not in merged_input:
                        continue
                    try:
                        lines.append(f"{k}: {json.dumps(merged_input[k], default=str)}")
                    except TypeError:
                        lines.append(f"{k}: {merged_input[k]!s}")
                if lines:
                    chain_prefix = "[Upstream chain context]\n" + "\n".join(lines) + "\n\n---\n\n"

        # When input includes RAG documents, pass them as clear text so the LLM can summarize
        docs = merged_input.get("documents")
        if isinstance(docs, list) and len(docs) > 0:
            parts = []
            for i, d in enumerate(docs):
                content = d.get("content") if isinstance(d, dict) else None
                if content:
                    parts.append(content.strip())
            if parts:
                user_content = "Retrieved context to summarize:\n\n" + "\n\n---\n\n".join(parts)
            else:
                user_content = json.dumps(merged_input)
        else:
            user_content = json.dumps(merged_input)
        user_content = chain_prefix + user_content
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


register(LLMCallerPlugin())
