"""
Minimal helper for running AI agent nodes.

This keeps behaviour simple while still giving a single place to evolve
agent logic (tools, memory, etc.) over time.
"""
from __future__ import annotations

from typing import Any

from app.services.llm_caller import call_llm


async def run_agent(
    *,
    model: str,
    system_prompt: str | None,
    tools: list[str],
    memory_source: str | None,
    output_mode: str,
    input_state: dict[str, Any],
    secrets: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Execute a minimal agent step.

    - Reads the user's question / text from the input state.
    - Builds a lightweight system prompt that mentions tools + memory.
    - Uses the existing call_llm helper.
    - Returns text or JSON-style result plus traces metadata.
    """
    base_system = system_prompt or "You are a helpful automation agent."

    tool_note = ""
    if tools:
        tool_list = ", ".join(tools)
        tool_note = (
            f"\nYou can conceptually rely on these downstream tools in the workflow: {tool_list}. "
            "However, do NOT describe low-level API calls; just output what should happen next."
        )

    memory_note = ""
    if memory_source:
        memory_note = (
            f"\nAssume you may read from a memory source called '{memory_source}' "
            "that contains past records or documents relevant to this workflow."
        )

    full_system_prompt = base_system + tool_note + memory_note

    # Derive user content from input_state; prefer common keys.
    if "question" in input_state:
        content = str(input_state["question"])
    elif "text" in input_state:
        content = str(input_state["text"])
    elif "input" in input_state:
        content = str(input_state["input"])
    else:
        # Fallback: compact representation of the state.
        content = str(input_state)

    messages = [{"role": "user", "content": content}]

    text = await call_llm(
        model=model,
        messages=messages,
        temperature=0.4,
        max_tokens=800,
        system_prompt=full_system_prompt,
        secrets=secrets,
    )

    traces: dict[str, Any] = {
        "model": model,
        "tools": tools,
        "memory_source": memory_source,
    }

    if output_mode.lower() == "json":
        import json

        try:
            parsed = json.loads(text)
        except Exception:
            parsed = {"raw": text}
        return {"result": parsed, "tool_calls": [], "traces": traces}

    return {"result": text, "tool_calls": [], "traces": traces}

