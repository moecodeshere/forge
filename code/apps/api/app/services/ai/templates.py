from __future__ import annotations

"""
Template library for AI-suggested workflows.

Each template returns a suggestion payload compatible with the /ai-builder
endpoint: rationale + nodes + edges, plus optional template metadata.

These templates are intentionally deterministic and conservative so that
suggested graphs are always well-formed and executable with mocked
integrations / LLMs.
"""

from dataclasses import dataclass
from typing import Any, Literal


TemplateId = Literal[
    "email_digest",
    "rag_chat",
    "news_summary",
    "weather_digest",
    "lead_qualification",
    "invoice_processing",
]


@dataclass
class TemplateSuggestion:
    template_id: TemplateId
    template_name: str
    rationale: str
    parameters: dict[str, Any]
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]

    def as_response(self) -> dict[str, Any]:
        """Shape used by the router / frontend."""
        return {
            "template_id": self.template_id,
            "template_name": self.template_name,
            "rationale": self.rationale,
            "parameters": self.parameters,
            "nodes": self.nodes,
            "edges": self.edges,
        }


def _schedule_trigger_node(node_id: str, label: str, cron: str) -> dict[str, Any]:
    return {
        "id": node_id,
        "type": "schedule_trigger",
        "position": {"x": 80, "y": 120},
        "data": {
            "label": label,
            "config": {
                "schedule_type": "cron",
                "cron_expression": cron,
            },
        },
    }


def _simple_llm_node(
    node_id: str,
    label: str,
    prompt: str,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    cfg: dict[str, Any] = {
        "model": "gpt-4o-mini",
        "prompt": prompt,
        "temperature": 0.4,
        "max_tokens": 800,
    }
    if system_prompt:
        cfg["system_prompt"] = system_prompt
    return {
        "id": node_id,
        "type": "simple_llm",
        "position": {"x": 420, "y": 120},
        "data": {"label": label, "config": cfg},
    }


def _gmail_send_node(
    node_id: str,
    label: str,
    to_email: str,
    subject: str,
) -> dict[str, Any]:
    return {
        "id": node_id,
        "type": "mcp_tool",
        "position": {"x": 760, "y": 120},
        "data": {
            "label": label,
            "config": {
                "provider": "gmail",
                "action": "send_email",
                "params": {
                    "to": to_email,
                    "subject": subject,
                    # body will be taken from upstream node output
                },
                "test_mode": True,
            },
        },
    }


def _data_table_insert_node(
    node_id: str,
    label: str,
    table_name: str,
) -> dict[str, Any]:
    return {
        "id": node_id,
        "type": "mcp_tool",
        "position": {"x": 780, "y": 260},
        "data": {
            "label": label,
            "config": {
                "provider": "data_table",
                "action": "insert_row",
                "params": {"table": table_name},
                "test_mode": True,
            },
        },
    }


# ---------------------------------------------------------------------------
# 1. Monday Gmail action-items digest
# ---------------------------------------------------------------------------


def build_email_digest_template(
    *,
    cron: str = "0 8 * * 1",
    gmail_query: str = "newer_than:3d in:inbox",
    recipient_email: str = "me@example.com",
) -> TemplateSuggestion:
    """Create a workflow that summarizes weekend Gmail into a Monday digest."""
    trigger = _schedule_trigger_node(
        "trigger_1",
        label="Monday Morning Trigger",
        cron=cron,
    )

    gmail_fetch = {
        "id": "gmail_fetch_1",
        "type": "mcp_tool",
        "position": {"x": 240, "y": 120},
        "data": {
            "label": "Fetch Weekend Emails",
            "config": {
                "provider": "gmail",
                "action": "search_messages",
                "params": {"query": gmail_query},
                "test_mode": True,
            },
        },
    }

    llm = _simple_llm_node(
        "llm_1",
        label="Analyze Emails for Action Items",
        prompt=(
            "You are an executive assistant. Given a list of emails from the weekend, "
            "extract clear action items, deadlines, and priorities. Return a structured "
            "summary that is easy to scan on Monday morning."
        ),
    )

    gmail_send = _gmail_send_node(
        "gmail_send_1",
        label="Send Email Digest",
        to_email=recipient_email,
        subject="Monday action items digest",
    )

    nodes = [trigger, gmail_fetch, llm, gmail_send]
    edges = [
        {"id": "e1", "source": trigger["id"], "target": gmail_fetch["id"]},
        {"id": "e2", "source": gmail_fetch["id"], "target": llm["id"]},
        {"id": "e3", "source": llm["id"], "target": gmail_send["id"]},
    ]

    params = {
        "cron": cron,
        "gmail_query": gmail_query,
        "recipient_email": recipient_email,
    }

    return TemplateSuggestion(
        template_id="email_digest",
        template_name="Gmail Monday Action-Items Digest",
        rationale="Detected a weekly Gmail summary pattern and created a Monday-morning digest workflow.",
        parameters=params,
        nodes=nodes,
        edges=edges,
    )


# ---------------------------------------------------------------------------
# 2. Document-to-chat RAG pipeline
# ---------------------------------------------------------------------------


def build_rag_chat_template(
    *,
    vector_index: str = "documents",
    top_k: int = 5,
) -> TemplateSuggestion:
    """Document-to-chat RAG workflow using a single chat trigger.

    The ingestion side is intentionally omitted in this minimal version so that
    the graph has a single trigger node, matching DAG validation rules.
    We assume documents have already been ingested into the vector index.
    """

    chat_trigger = {
        "id": "chat_trigger_1",
        "type": "app_event_trigger",
        "position": {"x": 80, "y": 200},
        "data": {
            "label": "Chat Message Trigger",
            "config": {"app": "chat", "event_type": "message_received"},
        },
    }

    vector_query = {
        "id": "vector_query_1",
        "type": "mcp_tool",
        "position": {"x": 260, "y": 200},
        "data": {
            "label": "Retrieve Top Chunks",
            "config": {
                "provider": "pinecone",
                "action": "query_vectors",
                "params": {"index": vector_index, "top_k": top_k},
                "test_mode": True,
            },
        },
    }

    rag_llm = _simple_llm_node(
        "rag_llm_1",
        label="Answer from Documents",
        prompt=(
            "You are a documentation QA assistant. Use ONLY the provided document "
            "chunks to answer the user's question. If the answer is not clearly "
            "present, respond exactly with: \"I couldn't find that in the uploaded documents.\""
        ),
    )
    rag_llm["position"] = {"x": 480, "y": 200}

    log_chat = _data_table_insert_node(
        "log_chat_1",
        label="Log Chat Interaction",
        table_name="chat_logs",
    )

    nodes = [
        chat_trigger,
        vector_query,
        rag_llm,
        log_chat,
    ]

    edges = [
        {"id": "e_chat_1", "source": chat_trigger["id"], "target": vector_query["id"]},
        {"id": "e_chat_2", "source": vector_query["id"], "target": rag_llm["id"]},
        {"id": "e_chat_3", "source": rag_llm["id"], "target": log_chat["id"]},
    ]

    params = {"vector_index": vector_index, "top_k": top_k}

    return TemplateSuggestion(
        template_id="rag_chat",
        template_name="Document-to-Chat RAG Pipeline",
        rationale="Detected a document-to-chat RAG pattern with upload + chat triggers.",
        parameters=params,
        nodes=nodes,
        edges=edges,
    )


# ---------------------------------------------------------------------------
# 3. News summary with image + Telegram
# ---------------------------------------------------------------------------


def build_news_summary_template(
    *,
    cron: str = "0 20 * * *",  # 8pm daily
    news_query: str = "artificial intelligence",
) -> TemplateSuggestion:
    trigger = _schedule_trigger_node(
        "trigger_news",
        label="Evening News Trigger",
        cron=cron,
    )

    news_fetch = {
        "id": "news_fetch_1",
        "type": "http_request",
        "position": {"x": 260, "y": 120},
        "data": {
            "label": "Fetch AI News",
            "config": {
                "method": "GET",
                "url": "https://newsapi.org/v2/everything",
                "query": {"q": news_query},
            },
        },
    }

    summarize = _simple_llm_node(
        "news_llm_1",
        label="Summarize Top Articles",
        prompt=(
            "Given a list of news articles about AI from today, pick the top 5 and "
            "summarize each in two sentences. Then identify the single most important "
            "article and output a short description suitable for image generation."
        ),
    )

    image_gen = {
        "id": "image_gen_1",
        "type": "mcp_tool",
        "position": {"x": 760, "y": 120},
        "data": {
            "label": "Generate Hero Image",
            "config": {
                "provider": "openai",
                "action": "generate_image",
                "params": {"model": "gpt-image-1"},
                "test_mode": True,
            },
        },
    }

    telegram = {
        "id": "telegram_send_1",
        "type": "mcp_tool",
        "position": {"x": 1040, "y": 120},
        "data": {
            "label": "Send Telegram Digest",
            "config": {
                "provider": "telegram",
                "action": "send_message_with_image",
                "params": {"chat_id": "me"},
                "test_mode": True,
            },
        },
    }

    nodes = [trigger, news_fetch, summarize, image_gen, telegram]
    edges = [
        {"id": "e1", "source": trigger["id"], "target": news_fetch["id"]},
        {"id": "e2", "source": news_fetch["id"], "target": summarize["id"]},
        {"id": "e3", "source": summarize["id"], "target": image_gen["id"]},
        {"id": "e4", "source": image_gen["id"], "target": telegram["id"]},
    ]

    params = {"cron": cron, "news_query": news_query}

    return TemplateSuggestion(
        template_id="news_summary",
        template_name="AI News Digest with Telegram",
        rationale="Detected an AI news monitoring pattern with nightly summaries and Telegram delivery.",
        parameters=params,
        nodes=nodes,
        edges=edges,
    )


# ---------------------------------------------------------------------------
# 4. Weather digest
# ---------------------------------------------------------------------------


def build_weather_digest_template(
    *,
    cron: str = "0 5 * * *",  # 5am
    location: str = "auto",
    recipient_email: str = "me@example.com",
) -> TemplateSuggestion:
    trigger = _schedule_trigger_node(
        "trigger_weather",
        label="Morning Weather Trigger",
        cron=cron,
    )

    weather = {
        "id": "weather_fetch_1",
        "type": "http_request",
        "position": {"x": 260, "y": 120},
        "data": {
            "label": "Fetch Weather",
            "config": {
                "method": "GET",
                "url": "https://api.openweathermap.org/data/2.5/weather",
                "query": {"q": location},
            },
        },
    }

    llm = _simple_llm_node(
        "weather_llm_1",
        label="Write Fun Weather Email",
        prompt=(
            "You are a friendly weather assistant. Given raw weather data, write a short, "
            "fun email describing how the day will feel and what the user should consider "
            "for clothing and plans."
        ),
    )

    gmail = _gmail_send_node(
        "weather_email_1",
        label="Send Weather Email",
        to_email=recipient_email,
        subject="This morning's weather",
    )

    nodes = [trigger, weather, llm, gmail]
    edges = [
        {"id": "e1", "source": trigger["id"], "target": weather["id"]},
        {"id": "e2", "source": weather["id"], "target": llm["id"]},
        {"id": "e3", "source": llm["id"], "target": gmail["id"]},
    ]

    params = {"cron": cron, "location": location, "recipient_email": recipient_email}

    return TemplateSuggestion(
        template_id="weather_digest",
        template_name="Morning Weather Email",
        rationale="Detected a daily weather briefing pattern and created a 5am digest workflow.",
        parameters=params,
        nodes=nodes,
        edges=edges,
    )


# ---------------------------------------------------------------------------
# 5. Lead qualification
# ---------------------------------------------------------------------------


def build_lead_qualification_template(
    *,
    table_name: str = "leads",
    score_threshold: int = 80,
) -> TemplateSuggestion:
    form_trigger = {
        "id": "lead_form_trigger",
        "type": "form_submission_trigger",
        "position": {"x": 80, "y": 120},
        "data": {
            "label": "Lead Capture Form",
            "config": {
                "form_schema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "email": {"type": "string"},
                        "company": {"type": "string"},
                        "use_case": {"type": "string"},
                    },
                    "required": ["email", "use_case"],
                },
            },
        },
    }

    llm = _simple_llm_node(
        "lead_llm_1",
        label="Qualify Lead",
        prompt=(
            "You are a sales assistant. Given a lead's details, assign a score from 0-100 "
            "and a short rationale. Output JSON with fields: score, tier, rationale."
        ),
    )
    llm["position"] = {"x": 320, "y": 120}

    log_lead = _data_table_insert_node(
        "lead_table_1",
        label="Store Lead In Table",
        table_name=table_name,
    )

    branch = {
        "id": "lead_branch_1",
        "type": "conditional_branch",
        "position": {"x": 640, "y": 120},
        "data": {
            "label": "Is High-Score Lead?",
            "config": {
                "conditions": [
                    {
                        "id": "cond_high",
                        "expr": f"score >= {score_threshold}",
                        "target": "high",
                        "label": "High score",
                    }
                ],
                "default_target": "low",
            },
        },
    }

    email_high = _gmail_send_node(
        "lead_email_high",
        label="Email High-Score Lead",
        to_email="{{input.email}}",
        subject="Let's schedule a quick intro call",
    )
    email_high["position"] = {"x": 900, "y": 60}

    nodes = [form_trigger, llm, log_lead, branch, email_high]
    edges = [
        {"id": "e1", "source": form_trigger["id"], "target": llm["id"]},
        {"id": "e2", "source": llm["id"], "target": log_lead["id"]},
        {"id": "e3", "source": log_lead["id"], "target": branch["id"]},
        {"id": "e4", "source": branch["id"], "target": email_high["id"]},
    ]

    params = {"table_name": table_name, "score_threshold": score_threshold}

    return TemplateSuggestion(
        template_id="lead_qualification",
        template_name="Lead Qualification from Website Form",
        rationale="Detected a lead capture and qualification pattern with follow-up email.",
        parameters=params,
        nodes=nodes,
        edges=edges,
    )


# ---------------------------------------------------------------------------
# 6. Invoice processing
# ---------------------------------------------------------------------------


def build_invoice_processing_template(
    *,
    table_name: str = "invoices",
    weekly_cron: str = "0 9 * * 1",  # Monday morning
) -> TemplateSuggestion:
    form_trigger = {
        "id": "invoice_form_trigger",
        "type": "form_submission_trigger",
        "position": {"x": 80, "y": 80},
        "data": {
            "label": "Invoice Upload Form",
            "config": {
                "form_schema": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string", "format": "binary"},
                        "email": {"type": "string"},
                    },
                    "required": ["file", "email"],
                },
            },
        },
    }

    extract_llm = _simple_llm_node(
        "invoice_llm_extract",
        label="Extract Invoice Data",
        prompt=(
            "Extract structured invoice data from the uploaded document. "
            "Return JSON with fields: invoice_number, date, currency, total_amount, vendor, line_items[]."
        ),
    )
    extract_llm["position"] = {"x": 320, "y": 80}

    validator = {
        "id": "invoice_validator_1",
        "type": "set_node",
        "position": {"x": 560, "y": 80},
        "data": {
            "label": "Validate Invoice Fields",
            "config": {
                "mode": "validate_invoice",
                "rules": {
                    "date": "valid_date",
                    "currency": "supported_currency",
                    "total_amount": "greater_than_zero",
                },
            },
        },
    }

    branch = {
        "id": "invoice_branch_1",
        "type": "conditional_branch",
        "position": {"x": 820, "y": 80},
        "data": {
            "label": "Validation Passed?",
            "config": {
                "conditions": [
                    {
                        "id": "cond_ok",
                        "expr": "is_valid == True",
                        "target": "ok",
                        "label": "Valid",
                    }
                ],
                "default_target": "error",
            },
        },
    }

    log_invoice = _data_table_insert_node(
        "invoice_table_1",
        label="Store Invoice In Table",
        table_name=table_name,
    )

    email_error = _gmail_send_node(
        "invoice_email_error",
        label="Send Validation Error Email",
        to_email="{{input.email}}",
        subject="Invoice validation failed",
    )
    email_error["position"] = {"x": 1080, "y": 40}

    email_ok = _gmail_send_node(
        "invoice_email_ok",
        label="Send Invoice Confirmation",
        to_email="{{input.email}}",
        subject="Invoice received",
    )
    email_ok["position"] = {"x": 1080, "y": 140}

    # The weekly spending report is intentionally omitted in this minimal version
    # so that the graph has a single trigger node (the form submission).

    nodes = [
        form_trigger,
        extract_llm,
        validator,
        branch,
        log_invoice,
        email_error,
        email_ok,
    ]

    edges = [
        {"id": "e1", "source": form_trigger["id"], "target": extract_llm["id"]},
        {"id": "e2", "source": extract_llm["id"], "target": validator["id"]},
        {"id": "e3", "source": validator["id"], "target": branch["id"]},
        {"id": "e4", "source": branch["id"], "target": log_invoice["id"]},
        {"id": "e5", "source": branch["id"], "target": email_error["id"]},
        {"id": "e6", "source": log_invoice["id"], "target": email_ok["id"]},
    ]

    params = {"table_name": table_name, "weekly_cron": weekly_cron}

    return TemplateSuggestion(
        template_id="invoice_processing",
        template_name="Invoice Processing & Weekly Report",
        rationale="Detected an invoice extraction + validation pattern with weekly spending reports.",
        parameters=params,
        nodes=nodes,
        edges=edges,
    )


def build_template(template_id: TemplateId, **kwargs: Any) -> TemplateSuggestion:
    """Factory so the classifier can instantiate templates by id."""
    if template_id == "email_digest":
        return build_email_digest_template(**kwargs)
    if template_id == "rag_chat":
        return build_rag_chat_template(**kwargs)
    if template_id == "news_summary":
        return build_news_summary_template(**kwargs)
    if template_id == "weather_digest":
        return build_weather_digest_template(**kwargs)
    if template_id == "lead_qualification":
        return build_lead_qualification_template(**kwargs)
    if template_id == "invoice_processing":
        return build_invoice_processing_template(**kwargs)
    raise ValueError(f"Unknown template_id: {template_id}")

