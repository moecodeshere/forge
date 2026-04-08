"""
Node plugin registry.
Plugins self-register on import; execution uses get_plugin() for dispatch.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import NodePlugin, NodePluginMeta


NODE_REGISTRY: dict[str, NodePlugin] = {}
"""Map node_type -> plugin instance."""


def register(plugin: NodePlugin) -> None:
    """Register a node plugin. Call from plugin module on import."""
    NODE_REGISTRY[plugin.meta.type] = plugin


def get_plugin(node_type: str) -> NodePlugin | None:
    """Look up plugin by node type. Returns None if unknown."""
    return NODE_REGISTRY.get(node_type)


def list_plugins() -> list[dict[str, Any]]:
    """Return metadata for all registered plugins (for GET /nodes API)."""
    return [
        {
            "type": p.meta.type,
            "category": p.meta.category,
            "label": p.meta.label,
            "description": p.meta.description,
            "inputs": p.meta.inputs,
            "outputs": p.meta.outputs,
            "config_schema": p.meta.config_schema,
            "ui_schema": p.meta.ui_schema,
        }
        for p in NODE_REGISTRY.values()
    ]
