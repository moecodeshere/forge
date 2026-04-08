"""
Node plugin system.
Import this module to ensure all plugins are registered.
"""
from __future__ import annotations

from app.services.nodes.registry import NODE_REGISTRY, get_plugin, list_plugins, register

# Import plugins so they self-register
from app.services.nodes import (
    action,
    ai_agent,
    app_event_trigger,
    approval_step,
    conditional_branch,
    delay,
    error_handler,
    filter_node,
    form_submission_trigger,
    http_request,
    json_parse,
    json_stringify,
    llm_caller,
    loop,
    manual_trigger,
    mcp_tool,
    merge,
    pdf_report,
    rag_retriever,
    research,
    schedule_trigger,
    set_node,
    simple_llm,
    sql_query,
    template_render,
    vision_extract,
    wait_callback,
    web_scrape,
    webhook_trigger,
)

__all__ = [
    "NODE_REGISTRY",
    "get_plugin",
    "list_plugins",
    "register",
]
