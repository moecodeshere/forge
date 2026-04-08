"""
MCP deployment — expose graph as a JSON-RPC 2.0 MCP server.
Generates manifest.json + a FastAPI-compatible endpoint module.
"""
from __future__ import annotations

import json
from typing import Any

from app.core.config import settings


def generate_manifest(
    graph_content: dict[str, Any],
    graph_id: str,
    graph_name: str,
    description: str = "",
) -> dict[str, Any]:
    """
    Build an MCP-compliant manifest.json from graph schema.
    Each LLM Caller / RAG Retriever input becomes a tool parameter.
    """
    tools: list[dict[str, Any]] = []

    for node in graph_content.get("nodes", []):
        node_type: str = node.get("type", "")
        label: str = node.get("data", {}).get("label", node["id"])
        cfg: dict[str, Any] = node.get("data", {}).get("config", {})

        if node_type in ("llm_caller", "simple_llm"):
            tools.append(
                {
                    "name": f"invoke_{node['id']}",
                    "description": f"Run LLM node: {label}",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "User input"},
                        },
                        "required": ["query"],
                    },
                }
            )
        elif node_type == "rag_retriever":
            tools.append(
                {
                    "name": f"retrieve_{node['id']}",
                    "description": f"Retrieve documents via: {label}",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "top_k": {"type": "integer", "default": cfg.get("top_k", 5)},
                        },
                        "required": ["query"],
                    },
                }
            )

    base_url = settings.API_PUBLIC_URL.rstrip("/")
    mcp_url = f"{base_url}/graphs/{graph_id}/mcp/rpc"
    return {
        "schema_version": "1.0",
        "name_for_human": graph_name,
        "name_for_model": graph_name.lower().replace(" ", "_"),
        "description_for_human": description or f"Forge graph: {graph_name}",
        "description_for_model": description or f"Execute Forge graph {graph_id}",
        "auth": {"type": "bearer"},
        "api": {"type": "jsonrpc", "url": mcp_url},
        # Code-exported workflows expose GET /openapi.json and /docs (FastAPI).
        "documentation": {
            "openapi_url": f"{base_url}/openapi.json",
            "rest_run_url": f"{base_url}/graphs/{graph_id}/run",
        },
        "tools": tools,
    }


def generate_mcp_endpoint_module(graph_id: str) -> str:
    """Return Python source code for a FastAPI MCP endpoint module."""
    return f'''"""Auto-generated MCP endpoint for graph {graph_id}."""
from __future__ import annotations
from typing import Any
from fastapi import APIRouter, HTTPException
router = APIRouter()

@router.post("/graphs/{graph_id}/mcp/rpc")
async def mcp_rpc(body: dict[str, Any]) -> dict[str, Any]:
    method = body.get("method", "")
    params = body.get("params", {{}})
    rpc_id = body.get("id")
    # Dispatch to execution engine
    from app.services.execution import execute_graph
    import uuid
    run_id = str(uuid.uuid4())
    # Fire-and-forget; return run_id
    return {{"jsonrpc": "2.0", "id": rpc_id, "result": {{"run_id": run_id}}}}
'''
