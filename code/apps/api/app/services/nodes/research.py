"""
Research node — web-grounded research using Perplexity (or similar).
Input: query from state. Output: research result with citations.
"""
from __future__ import annotations

import json
from typing import Any

from app.services.llm_caller import call_llm
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register

DEFAULT_RESEARCH_MODEL = "perplexity/llama-3.1-sonar-small-128k-online"


class ResearchPlugin:
    meta = NodePluginMeta(
        type="research",
        category="ai",
        label="Web Research",
        description="Run web-grounded research (Perplexity). Returns answers with sources. Use for reports, fact-checking, or deep dives.",
        inputs=["query"],
        outputs=["output", "sources"],
        config_schema={
            "type": "object",
            "properties": {
                "model": {"type": "string", "default": DEFAULT_RESEARCH_MODEL},
                "system_prompt": {"type": "string"},
                "max_tokens": {"type": "integer", "default": 2048},
            },
        },
        ui_schema={
            "model": {"widget": "text", "placeholder": "perplexity/llama-3.1-sonar-small-128k-online"},
            "system_prompt": {"widget": "textarea", "placeholder": "e.g. Be concise. Cite sources."},
            "max_tokens": {"widget": "number", "min": 256, "max": 8192},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        model = str(cfg.get("model") or DEFAULT_RESEARCH_MODEL).strip()
        system_prompt = str(cfg.get("system_prompt") or "").strip()
        max_tokens = int(cfg.get("max_tokens") or 2048)
        merged = state.get("_input") or state
        query = (
            merged.get("query")
            or merged.get("message")
            or merged.get("question")
            or (merged.get("body", {}).get("query") if isinstance(merged.get("body"), dict) else None)
        )
        if isinstance(query, dict):
            query = query.get("query") or json.dumps(query)
        query = str(query or "").strip() or "Summarize the latest news on AI."
        messages = [{"role": "user", "content": query}]
        secrets = state.get("_secrets") or {}
        if not isinstance(secrets, dict):
            secrets = {}
        sys = system_prompt or "Answer based on web search. Be factual and cite sources when possible."
        result = await call_llm(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=max_tokens,
            system_prompt=sys,
            secrets=secrets,
        )
        return {"output": result, "sources": result, "query": query}


register(ResearchPlugin())
