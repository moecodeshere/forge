from __future__ import annotations

"""
Node catalog and few-shot examples for AI workflow suggestions.

This module provides:
- A machine-readable catalog describing each Forge node type.
- Helper to build a compact system prompt describing node semantics.
- A small set of few-shot examples mapping user prompts to templates.

The catalog is intended to be consumed by LLM-based services (for example,
an AI classifier that picks a workflow template and parameters from a prompt).
"""

from dataclasses import dataclass
from typing import Any

from app.services.ai.templates import TemplateId


@dataclass(frozen=True)
class NodeSpec:
    type: str
    title: str
    category: str
    purpose: str
    inputs: str
    outputs: str
    important_config: list[str]
    notes: str | None = None


NODE_CATALOG: dict[str, NodeSpec] = {
    "manual_trigger": NodeSpec(
        type="manual_trigger",
        title="Manual Trigger",
        category="Trigger",
        purpose="Start a workflow only when the user clicks Run or calls the execution API.",
        inputs="None",
        outputs="Initial workflow state",
        important_config=[
            "label: display name in the canvas UI",
        ],
        notes="Use for ad-hoc runs and testing where no external event should auto-start the workflow.",
    ),
    "webhook_trigger": NodeSpec(
        type="webhook_trigger",
        title="Webhook Trigger",
        category="Trigger",
        purpose="Start a workflow when an external HTTP request is received.",
        inputs="Incoming HTTP request payload",
        outputs="Parsed request body and headers",
        important_config=[
            "path: relative URL path configured for the webhook endpoint",
            "secret / auth: optional shared secret or token to validate callers",
        ],
        notes="Use when another system should start the workflow via HTTP POST.",
    ),
    "schedule_trigger": NodeSpec(
        type="schedule_trigger",
        title="Schedule Trigger",
        category="Trigger",
        purpose="Start a workflow on a fixed schedule (interval or cron).",
        inputs="None",
        outputs="Initial workflow state with current timestamp",
        important_config=[
            "schedule_type: 'interval' or 'cron'",
            "interval_value, interval_unit: how often to run when using interval scheduling",
            "cron_expression: cron string such as '0 8 * * 1' for Monday 8am",
        ],
        notes="Use for periodic jobs such as daily digests, nightly summaries, and weekly reports.",
    ),
    "form_submission_trigger": NodeSpec(
        type="form_submission_trigger",
        title="Form Submission Trigger",
        category="Trigger",
        purpose="Start a workflow when a user submits a hosted form.",
        inputs="Form submission payload",
        outputs="Structured form data based on the configured JSON Schema",
        important_config=[
            "form_schema: JSON Schema describing fields and validation rules",
            "webhook_path: optional path where form submissions are posted",
        ],
        notes="Use for lead capture, invoice uploads, or any user-facing form-based entry.",
    ),
    "app_event_trigger": NodeSpec(
        type="app_event_trigger",
        title="App Event Trigger",
        category="Trigger",
        purpose="Start a workflow when an event occurs inside an app (e.g. chat message).",
        inputs="Event payload from the configured app",
        outputs="Normalized event fields (e.g. message text, user id, timestamp)",
        important_config=[
            "app: source application (telegram, notion, airtable, other)",
            "event_type: event name such as 'message_received'",
        ],
        notes="Use for chatbots or integrations that react to messages or in-app events.",
    ),
    "llm_caller": NodeSpec(
        type="llm_caller",
        title="LLM Caller",
        category="AI",
        purpose="Call a chat-style LLM with system instructions and context to get a response.",
        inputs="text input and optional context",
        outputs="LLM text response and optional tool calls",
        important_config=[
            "model: provider model id (e.g. gpt-4o, claude-3-5-sonnet-20241022)",
            "temperature: creativity / randomness between 0 and 1",
            "max_tokens: maximum tokens to generate",
            "system_prompt: optional instructions controlling the assistant behaviour",
            "stream: whether to stream tokens during execution",
        ],
        notes="Use for free-form chat, classification, or generation tasks that do not need strict JSON output.",
    ),
    "simple_llm": NodeSpec(
        type="simple_llm",
        title="Simple LLM",
        category="AI",
        purpose="Lightweight text generation node for templates and scripted prompts.",
        inputs="text or structured fields from previous nodes",
        outputs="LLM-generated text",
        important_config=[
            "model: provider model id",
            "prompt: template prompt string (can reference {{input.*}} fields)",
            "system_prompt: optional system instructions",
            "temperature, max_tokens: generation controls",
        ],
        notes="Primarily used inside canonical templates for deterministic flows such as digests and reports.",
    ),
    "rag_retriever": NodeSpec(
        type="rag_retriever",
        title="RAG Retriever",
        category="AI / RAG",
        purpose="Look up relevant documents from a vector store using an embedding model.",
        inputs="User query text",
        outputs="List of retrieved documents / chunks with similarity scores",
        important_config=[
            "embedding_model: embedding model name (e.g. text-embedding-3-small)",
            "top_k: maximum number of neighbors to return (<= 20)",
            "min_score: similarity threshold between 0 and 1",
            "collection_id: optional pgvector collection identifier",
        ],
        notes="Use before an LLM answer step to implement retrieval-augmented generation.",
    ),
    "ai_agent": NodeSpec(
        type="ai_agent",
        title="AI Agent",
        category="AI",
        purpose="Run a higher-level agent that reasons over context using a chosen model, optional tools, and memory.",
        inputs="User question and context from previous nodes",
        outputs="Agent result as text or JSON plus any tool call traces",
        important_config=[
            "model: provider model id (e.g. gpt-4o-mini)",
            "system_prompt: high-level instructions and behaviour",
            "tools: list of logical tool names the agent may call",
            "memory_source: name of long-term memory or collection",
            "output_mode: 'text' or 'json' depending on downstream needs",
        ],
        notes="Use when a single LLM call is not enough and you want an agent-style node that can coordinate tools.",
    ),
    "conditional_branch": NodeSpec(
        type="conditional_branch",
        title="Conditional Branch",
        category="Control",
        purpose="Route execution to different branches based on an expression.",
        inputs="A value or structured object from the previous node",
        outputs="Branch id / target node selection",
        important_config=[
            "conditions: list of {id, expr, target, label}",
            "default_target: fallback target when no condition matches",
        ],
        notes="Expressions are evaluated against the node input; they should be simple and deterministic.",
    ),
    "mcp_tool": NodeSpec(
        type="mcp_tool",
        title="MCP Tool",
        category="Integration",
        purpose="Call an external tool via Model Context Protocol or a provider-specific API.",
        inputs="Structured parameters produced by previous nodes",
        outputs="Tool result (e.g. API response, created record)",
        important_config=[
            "provider: logical provider name (gmail, telegram, data_table, pinecone, etc.)",
            "action: provider-specific action name (send_email, query_vectors, insert_row, ...)",
            "params: JSON object passed to the underlying tool or API",
             "server_url: MCP server base URL when calling tools via MCP",
             "tool_name: identifier of the MCP tool to call",
            "test_mode: when true, runs in a safe mocked or non-destructive mode",
        ],
        notes="Use for side effects like sending emails, posting messages, or persisting data.",
    ),
    "http_request": NodeSpec(
        type="http_request",
        title="HTTP Request",
        category="Integration",
        purpose="Perform a generic HTTP request to any URL.",
        inputs="Optional request body or parameters from previous nodes",
        outputs="Parsed HTTP response (status, headers, body)",
        important_config=[
            "method: HTTP method such as GET or POST",
            "url: full request URL",
            "headers: optional headers object",
            "body: optional request body",
        ],
        notes="Use when no dedicated MCP integration exists and a raw HTTP call is sufficient.",
    ),
    "set_node": NodeSpec(
        type="set_node",
        title="Set Node",
        category="Utility",
        purpose="Transform or enrich the workflow state (set, rename, or remove fields).",
        inputs="Current workflow state",
        outputs="Modified workflow state",
        important_config=[
            "mode: operation mode such as 'chunk_text' or 'validate_invoice'",
            "rules / fields: mode-specific configuration for the transformation",
        ],
        notes="Acts as glue logic inside templates, for example chunking text or validating structured data.",
    ),
    "approval_step": NodeSpec(
        type="approval_step",
        title="Approval Step",
        category="Human-in-the-loop",
        purpose="Pause execution until a human approves or rejects with optional feedback.",
        inputs="Request data prepared by previous nodes",
        outputs="Object containing approved flag and feedback text",
        important_config=[
            "title: short title for the approval request",
            "description: optional long description",
            "form_schema: optional JSON Schema for additional review fields",
            "timeout_hours: how long to wait before timing out",
            "notify_email: optional email to notify approvers",
        ],
        notes="Use when a human must review AI output or high-impact actions before continuing.",
    ),
}


def build_node_catalog_prompt() -> str:
    """
    Build a compact, deterministic system prompt that teaches the LLM about
    each available node type and how it should be used.
    """
    lines: list[str] = []
    lines.append("You are an assistant that designs Forge workflow graphs.")
    lines.append(
        "Forge workflows are directed acyclic graphs of typed nodes connected by edges."
    )
    lines.append(
        "Each node type has specific semantics, inputs, outputs, and configuration fields."
    )
    lines.append("Available node types:")
    for spec in NODE_CATALOG.values():
        lines.append(f"- {spec.type} — {spec.title} [{spec.category}]")
        lines.append(f"  Purpose: {spec.purpose}")
        lines.append(f"  Inputs: {spec.inputs}")
        lines.append(f"  Outputs: {spec.outputs}")
        if spec.important_config:
            joined_cfg = "; ".join(spec.important_config)
            lines.append(f"  Important config: {joined_cfg}")
        if spec.notes:
            lines.append(f"  Notes: {spec.notes}")
    lines.append(
        "When selecting a workflow template or configuring nodes, only use these node "
        "types and respect their intended purposes and configuration fields."
    )
    return "\n".join(lines)


CLASSIFICATION_FEW_SHOT_EXAMPLES: list[dict[str, Any]] = [
    {
      "user_prompt": "Every Monday morning, summarize my weekend Gmail into an action items digest email.",
      "template_id": "email_digest",
      "parameter_values": {
          "cron": "0 8 * * 1",
          "gmail_query": "newer_than:3d in:inbox",
          "recipient_email": "me@example.com",
      },
    },
    {
      "user_prompt": "I want a document-to-chat assistant: I upload PDFs, then ask questions in a chat sidebar that uses RAG.",
      "template_id": "rag_chat",
      "parameter_values": {
          "vector_index": "documents",
          "top_k": 5,
      },
    },
    {
      "user_prompt": "Create a nightly AI news digest about artificial intelligence and send it with an image to my Telegram.",
      "template_id": "news_summary",
      "parameter_values": {
          "cron": "0 20 * * *",
          "news_query": "artificial intelligence",
      },
    },
    {
      "user_prompt": "When a lead fills out my website form, score the lead from 0-100 and email the high-score leads.",
      "template_id": "lead_qualification",
      "parameter_values": {
          "table_name": "leads",
          "score_threshold": 80,
      },
    },
    {
      "user_prompt": "Let users upload invoices, extract the structured data, validate it, and send a weekly spending summary.",
      "template_id": "invoice_processing",
      "parameter_values": {
          "table_name": "invoices",
          "weekly_cron": "0 9 * * 1",
      },
    },
]


def build_classification_system_prompt() -> str:
    """
    Build a system prompt for an LLM that must classify a natural-language
    request into a known workflow template and parameter values.

    The model is expected to output JSON of the form:
      {"template_id": <TemplateId>, "parameter_values": {...}}
    """
    catalog = build_node_catalog_prompt()
    lines = [catalog]
    lines.append("")
    lines.append(
        "You must respond with a strict JSON object: "
        '{"template_id": <one of the known template ids>, "parameter_values": {...}}.'
    )
    lines.append(
        "template_id must be one of: "
        + ", ".join(sorted(t for t in TemplateId.__args__))  # type: ignore[attr-defined]
    )
    lines.append(
        "parameter_values should contain schedule times, email addresses, API queries, "
        "and other knobs that specialize the chosen template for the user."
    )
    lines.append("Here are example mappings from user prompts to templates:")
    for example in CLASSIFICATION_FEW_SHOT_EXAMPLES:
        lines.append("")
        lines.append(f"User prompt: {example['user_prompt']}")
        lines.append(
            "Expected JSON: "
            f'{{"template_id": "{example["template_id"]}", '
            f'"parameter_values": {example["parameter_values"]}}}'
        )
    return "\n".join(lines)

