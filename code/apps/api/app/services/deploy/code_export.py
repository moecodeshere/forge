"""
Code export — generate a self-contained LangGraph Python project ZIP.
Uses node registry for dispatch; falls back to generic stub for unknown types.
"""
from __future__ import annotations

import io
import json
import zipfile
from typing import Any

from app.services.nodes import get_plugin

REQUIREMENTS = """\
langgraph>=0.2
litellm>=1.50
python-dotenv>=1.0
httpx>=0.27
fastapi>=0.115
uvicorn>=0.32
"""

ENV_EXAMPLE = """\
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
"""

README = """\
# {graph_name} — Exported Forge Workflow

Runnable LangGraph + FastAPI project (production-oriented layout).

## Quick start

```bash
pip install -r requirements.txt
cp .env.example .env   # then add your API keys
uvicorn app:app --reload
```

- **POST /run** — Run the workflow (body = input JSON, e.g. `{{"query": "Hello"}}`)
- **GET /docs** — Swagger UI (human-readable API)
- **GET /openapi.json** — Machine-readable OpenAPI 3 schema (import into Postman, gateways, MCP tooling)
- **GET /health** — Liveness probe for orchestrators / k8s
- **CLI:** `python main.py` — runs with default input

## MCP + REST

Point MCP clients at your deployed **POST /run** or wrap this service with a thin JSON-RPC shim.
The OpenAPI document describes the REST surface for CI and partner integrations.

## Project layout

- `main.py` — LangGraph runner (CLI)
- `app.py` — FastAPI wrapper with POST /run + OpenAPI
- `nodes/` — Node implementations
"""


def _indent(code: str, spaces: int = 4) -> str:
    return "\n".join((" " * spaces) + line if line.strip() else line for line in code.splitlines())


def _gen_main(graph_content: dict[str, Any], graph_name: str) -> str:
    node_ids = [n["id"] for n in graph_content.get("nodes", [])]
    edges = graph_content.get("edges", [])

    # Import from nodes/{node_id}.py (each node has its own module file)
    imports = "\n".join(
        f"from nodes.{n['id'].replace('-', '_')} import execute_{n['id'].replace('-', '_')} as node_{n['id'].replace('-', '_')}"
        for n in graph_content.get("nodes", [])
    )

    add_nodes = "\n".join(
        f'    graph.add_node("{n["id"]}", node_{n["id"].replace("-", "_")})'
        for n in graph_content.get("nodes", [])
    )

    add_edges = "\n".join(
        f'    graph.add_edge("{e["source"]}", "{e["target"]}")'
        for e in edges
    )

    return f'''"""
Auto-generated LangGraph runner for: {graph_name}
Run: python main.py
"""
from __future__ import annotations
import asyncio, json
from typing import Any
from dotenv import load_dotenv
load_dotenv()

try:
    from langgraph.graph import StateGraph, END  # type: ignore
except ImportError:
    raise SystemExit("Install dependencies: pip install -r requirements.txt")

{imports}

GRAPH_JSON = {json.dumps(graph_content, indent=2)}


def build_graph() -> StateGraph:
    graph = StateGraph(dict)
{_indent(add_nodes, 4)}
{_indent(add_edges, 4)}
    graph.set_entry_point({json.dumps(node_ids[0]) if node_ids else '"start"'})
    return graph.compile()


async def main(input_data: dict[str, Any]) -> Any:
    app = build_graph()
    result = await app.ainvoke(input_data)
    print(json.dumps(result, indent=2, default=str))
    return result


if __name__ == "__main__":
    asyncio.run(main({{"query": "Hello from Forge!"}}))
'''


def _gen_app(graph_name: str) -> str:
    """Generate FastAPI app with POST /run and OpenAPI at /docs."""
    return f'''"""
FastAPI wrapper for {graph_name}.
Run: uvicorn app:app --reload
POST /run — body = input JSON
GET /docs — OpenAPI documentation
"""
from __future__ import annotations
from typing import Any
from fastapi import FastAPI

from main import build_graph

app = FastAPI(
    title="{graph_name}",
    description="Exported Forge workflow — POST /run to execute",
    version="1.0.0",
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Load balancer / platform liveness."""
    return {{"status": "ok"}}


@app.post("/run")
async def run_endpoint(body: dict[str, Any]) -> dict[str, Any]:
    """Execute the workflow. Body is passed as input state (e.g. {{"query": "Hello"}})."""
    graph = build_graph()
    result = await graph.ainvoke(body)
    return result
'''


def _gen_node_module(node: dict[str, Any]) -> str:
    node_id = node["id"].replace("-", "_")
    node_type: str = node.get("type", "unknown")
    cfg: dict[str, Any] = node.get("data", {}).get("config", {})

    plugin = get_plugin(node_type)
    if plugin is not None and hasattr(plugin, "export_code"):
        code = plugin.export_code(node)
        if code:
            return code

    # Fallback code generation for known types
    if node_type in ("llm_caller", "simple_llm"):
        model = cfg.get("model", "gpt-4o-mini")
        system = cfg.get("system_prompt", "You are helpful.")
        return f'''"""LLM node: {node["id"]}"""
from __future__ import annotations
from typing import Any
import litellm  # type: ignore

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    messages = [
        {{"role": "system", "content": {json.dumps(system)}}},
        {{"role": "user", "content": str(state.get("query", ""))}},
    ]
    resp = await litellm.acompletion(model={json.dumps(model)}, messages=messages)
    return {{**state, "output": resp.choices[0].message.content}}
'''

    if node_type == "rag_retriever":
        return f'''"""RAG Retriever node: {node["id"]}"""
from __future__ import annotations
from typing import Any

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    query = str(state.get("query", ""))
    documents: list[dict] = []
    return {{**state, "documents": documents}}
'''

    if node_type in ("manual_trigger", "webhook_trigger", "schedule_trigger", "form_submission_trigger", "app_event_trigger"):
        return f'''"""Trigger node: {node["id"]}"""
from __future__ import annotations
from typing import Any

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    return {{**state}}
'''

    if node_type == "http_request":
        method = cfg.get("method", "GET")
        url = cfg.get("url", "https://example.com")
        return f'''"""HTTP Request node: {node["id"]}"""
from __future__ import annotations
from typing import Any
import httpx

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.request({json.dumps(method)}, {json.dumps(url)})
    return {{**state, "status": resp.status_code, "body": resp.json()}}
'''

    if node_type == "set_node":
        return f'''"""Set node: {node["id"]}"""
from __future__ import annotations
from typing import Any

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    return {{**state}}
'''

    if node_type == "delay":
        seconds = float(cfg.get("seconds", 5))
        seconds = max(0.1, min(3600, seconds))
        return f'''"""Delay node: {node["id"]}"""
from __future__ import annotations
import asyncio
from typing import Any

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    await asyncio.sleep({seconds})
    return {{**state}}
'''

    if node_type == "json_parse":
        source_key = str(cfg.get("source_key", "body"))
        return f'''"""JSON Parse node: {node["id"]}"""
from __future__ import annotations
import json
from typing import Any

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    raw = state.get("{source_key}", state.get("body", "{{}}"))
    s = str(raw).strip() or "{{}}"
    parsed = json.loads(s)
    return {{**state, "data": parsed}}
'''

    if node_type == "json_stringify":
        source_key = str(cfg.get("source_key", "data"))
        return f'''"""JSON Stringify node: {node["id"]}"""
from __future__ import annotations
import json
from typing import Any

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    obj = state.get("{source_key}", state.get("data", {{}}))
    return {{**state, "json_string": json.dumps(obj)}}
'''

    if node_type == "merge":
        return f'''"""Merge node: {node["id"]}"""
from __future__ import annotations
from typing import Any

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    return {{**state}}
'''

    if node_type == "filter":
        source_key = str(cfg.get("source_key", "data"))
        return f'''"""Filter node: {node["id"]}"""
from __future__ import annotations
from typing import Any

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    arr = state.get("{source_key}", state.get("data", []))
    if not isinstance(arr, list):
        arr = [arr] if arr else []
    filtered = [x for x in arr if x]
    return {{**state, "filtered": filtered, "data": filtered}}
'''

    return f'''"""Node: {node["id"]} ({node_type})"""
from __future__ import annotations
from typing import Any

async def execute_{node_id}(state: dict[str, Any]) -> dict[str, Any]:
    return {{**state}}
'''


def export_as_zip(graph_content: dict[str, Any], graph_name: str) -> bytes:
    """Return in-memory ZIP bytes of the generated Python project."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("main.py", _gen_main(graph_content, graph_name))
        zf.writestr("app.py", _gen_app(graph_name))
        zf.writestr("requirements.txt", REQUIREMENTS)
        zf.writestr(".env.example", ENV_EXAMPLE)
        zf.writestr("README.md", README.format(graph_name=graph_name))
        zf.writestr(
            "OPENAPI.md",
            """# OpenAPI

When the app is running (`uvicorn app:app`):

- **GET /openapi.json** — OpenAPI 3 schema (for gateways, codegen, MCP HTTP bridges)
- **GET /docs** — Swagger UI

Forge’s hosted API also serves `/openapi.json` for first-party integrations.
""",
        )
        zf.writestr("nodes/__init__.py", "")

        for node in graph_content.get("nodes", []):
            module_name = f"nodes/{node['id'].replace('-', '_')}.py"
            zf.writestr(module_name, _gen_node_module(node))

    buf.seek(0)
    return buf.read()
