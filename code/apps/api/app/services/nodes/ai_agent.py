"""
AI Agent node plugin.

This node represents a higher-level agent that can call an LLM with an
optional system prompt. In the first version we don't directly invoke
tools or memory from the plugin; instead, the upstream/downstream nodes
provide context and consume the output. The config is kept compatible
with AiAgentConfigSchema from shared-schemas.
"""
from __future__ import annotations

from typing import Any

from app.services.agent_runner import run_agent
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class AiAgentPlugin:
    meta = NodePluginMeta(
        type="ai_agent",
        category="ai",
        label="AI Agent",
        description="Reason over context with a chosen model and optional tools/memory.",
        inputs=["context"],
        outputs=["result"],
        config_schema={
            "type": "object",
            "properties": {
                "model": {"type": "string", "default": "gpt-4o-mini"},
                "system_prompt": {"type": "string"},
                "tools": {"type": "array", "items": {"type": "string"}},
                "memory_source": {"type": "string"},
                "output_mode": {"type": "string", "enum": ["text", "json"], "default": "text"},
            },
        },
        ui_schema={
            "model": {
                "widget": "select",
                "options": ["gpt-4o-mini", "gpt-4o", "claude-3-haiku-20240307", "gemini-2.0-flash"],
            },
            "system_prompt": {"widget": "textarea"},
            "tools": {"widget": "multiselect"},
            "memory_source": {"widget": "text", "placeholder": "e.g. invoices, leads, documents"},
            "output_mode": {"widget": "select", "options": ["text", "json"]},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        data = node.get("data", {})
        cfg = data.get("config", {}) or {}

        model = str(cfg.get("model") or "gpt-4o-mini")
        system_prompt = cfg.get("system_prompt")
        tools = cfg.get("tools") or []
        if not isinstance(tools, list):
            tools = []
        memory_source = cfg.get("memory_source")
        output_mode = str(cfg.get("output_mode") or "text")

        input_state = state.get("_input") or {}
        if not isinstance(input_state, dict):
            input_state = {"input": input_state}

        secrets = state.get("_secrets") or {}
        if not isinstance(secrets, dict):
            secrets = {}

        agent_result = await run_agent(
            model=model,
            system_prompt=system_prompt,
            tools=[str(t) for t in tools],
            memory_source=str(memory_source) if memory_source else None,
            output_mode=output_mode,
            input_state=input_state,
            secrets=secrets,
        )

        return agent_result


register(AiAgentPlugin())

