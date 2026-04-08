from __future__ import annotations

from typing import Any

from app.services.ai.templates import TemplateSuggestion, build_template


def _classify_to_template(prompt: str) -> TemplateSuggestion | None:
    """Heuristic classifier mapping prompts onto high-level templates."""
    text = prompt.lower()

    if "gmail" in text and "monday" in text and "weekend" in text:
        return build_template("email_digest")

    if ("document-to-chat" in text) or ("rag" in text and "upload" in text):
        return build_template("rag_chat")

    if "newsapi" in text or ("news" in text and "telegram" in text):
        return build_template("news_summary")

    if "openweather" in text or ("weather" in text and "morning" in text):
        return build_template("weather_digest")

    if "lead" in text and "form" in text:
        return build_template("lead_qualification")

    if "invoice" in text and "form" in text:
        return build_template("invoice_processing")

    return None


def _legacy_suggest(text: str) -> dict[str, Any]:
    """Original rule-based suggestions kept as a fallback."""
    if not text:
        return {
            "rationale": "Empty prompt received. Returning a minimal starter workflow.",
            "nodes": [
                {
                    "id": "llm_1",
                    "type": "llm_caller",
                    "position": {"x": 280, "y": 180},
                    "data": {
                        "label": "Generate Response",
                        "config": {"model": "gpt-4o-mini", "temperature": 0.5, "max_tokens": 700},
                    },
                }
            ],
            "edges": [],
        }

    # Slack alert workflow
    if "slack" in text:
        return {
            "rationale": "Detected Slack intent. Added AI classification followed by Slack action.",
            "nodes": [
                {
                    "id": "llm_1",
                    "type": "llm_caller",
                    "position": {"x": 180, "y": 180},
                    "data": {
                        "label": "Classify Message",
                        "config": {"model": "gpt-4o-mini", "temperature": 0.2, "max_tokens": 400},
                    },
                },
                {
                    "id": "mcp_1",
                    "type": "mcp_tool",
                    "position": {"x": 480, "y": 180},
                    "data": {
                        "label": "Post to Slack",
                        "config": {
                            "provider": "slack",
                            "action": "post_message",
                            "params": {"channel": "#general", "text": "Automated notification"},
                            "test_mode": True,
                        },
                    },
                },
            ],
            "edges": [{"id": "e1", "source": "llm_1", "target": "mcp_1"}],
        }

    # Email automation workflow
    if "email" in text or "gmail" in text:
        return {
            "rationale": "Detected email intent. Added summary generation then Gmail action.",
            "nodes": [
                {
                    "id": "llm_1",
                    "type": "llm_caller",
                    "position": {"x": 160, "y": 180},
                    "data": {
                        "label": "Summarize",
                        "config": {"model": "gpt-4o-mini", "temperature": 0.3, "max_tokens": 600},
                    },
                },
                {
                    "id": "mcp_1",
                    "type": "mcp_tool",
                    "position": {"x": 460, "y": 180},
                    "data": {
                        "label": "Send Gmail",
                        "config": {
                            "provider": "gmail",
                            "action": "send_email",
                            "params": {
                                "to": "example@company.com",
                                "subject": "Automated update",
                                "body": "Draft from workflow",
                            },
                            "test_mode": True,
                        },
                    },
                },
            ],
            "edges": [{"id": "e1", "source": "llm_1", "target": "mcp_1"}],
        }

    # Sheet/Notion data workflows
    if "sheet" in text or "spreadsheet" in text or "notion" in text:
        provider = "notion" if "notion" in text else "sheets"
        action = "create_page" if provider == "notion" else "append_row"
        label = "Write to Notion" if provider == "notion" else "Append Sheet Row"
        return {
            "rationale": "Detected data logging intent. Added extraction node then persistence action.",
            "nodes": [
                {
                    "id": "llm_1",
                    "type": "llm_caller",
                    "position": {"x": 180, "y": 180},
                    "data": {
                        "label": "Extract Fields",
                        "config": {"model": "gpt-4o-mini", "temperature": 0.1, "max_tokens": 450},
                    },
                },
                {
                    "id": "mcp_1",
                    "type": "mcp_tool",
                    "position": {"x": 480, "y": 180},
                    "data": {
                        "label": label,
                        "config": {
                            "provider": provider,
                            "action": action,
                            "params": {},
                            "test_mode": True,
                        },
                    },
                },
            ],
            "edges": [{"id": "e1", "source": "llm_1", "target": "mcp_1"}],
        }

    # Default generic AI starter
    return {
        "rationale": "Used default assistant pattern with generation and optional approval.",
        "nodes": [
            {
                "id": "llm_1",
                "type": "llm_caller",
                "position": {"x": 180, "y": 180},
                "data": {
                    "label": "Generate Draft",
                    "config": {"model": "gpt-4o-mini", "temperature": 0.6, "max_tokens": 900},
                },
            },
            {
                "id": "approve_1",
                "type": "approval_step",
                "position": {"x": 480, "y": 180},
                "data": {"label": "Review Output", "config": {}},
            },
        ],
        "edges": [{"id": "e1", "source": "llm_1", "target": "approve_1"}],
    }


def suggest_workflow_from_prompt(prompt: str) -> dict[str, Any]:
    """Generate a workflow skeleton from natural language.

    First try to match one of the rich templates, then fall back to the
    legacy rule-based suggestions.
    """
    text = prompt.lower().strip()

    template_suggestion = _classify_to_template(prompt)
    if template_suggestion is not None:
        return template_suggestion.as_response()

    return _legacy_suggest(text)

