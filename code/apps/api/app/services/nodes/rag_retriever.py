"""
RAG Retriever node plugin.
"""
from __future__ import annotations

import json
from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register
from app.services.rag_retriever import retrieve_documents

DEFAULT_COLLECTION_ID = "00000000-0000-0000-0000-000000000001"


class RAGRetrieverPlugin:
    meta = NodePluginMeta(
        type="rag_retriever",
        category="ai",
        label="RAG Retriever",
        description="Retrieve documents by semantic similarity.",
        inputs=["query"],
        outputs=["documents", "count"],
        config_schema={
            "type": "object",
            "properties": {
                "top_k": {"type": "integer", "default": 5},
                "min_score": {"type": "number", "default": 0.65},
                "collection_id": {"type": "string"},
                "embedding_model": {"type": "string", "default": "text-embedding-3-small"},
            },
        },
        ui_schema={
            "top_k": {"widget": "number", "min": 1, "max": 20},
            "min_score": {"widget": "number", "min": 0, "max": 1, "step": 0.01},
            "collection_id": {"widget": "text", "placeholder": "UUID"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        top_k = min(int(cfg.get("top_k", 5)), 20)
        min_score = float(cfg.get("min_score", 0.65))
        raw_cid = cfg.get("collection_id")
        cid = str(raw_cid).strip() if isinstance(raw_cid, str) else ""
        # Use default collection when empty; use None (no filter) when default so we find
        # docs regardless of collection_id alignment between upload and retrieval
        use_default_query = False
        if len(cid) == 36 and cid != DEFAULT_COLLECTION_ID:
            collection_id: str | None = cid
        else:
            collection_id = None  # no filter - search all documents

        embedding_model = cfg.get("embedding_model", "text-embedding-3-small")

        query = str(state.get("_input", {}).get("query", "")).strip()
        if not query:
            query = json.dumps(state.get("_input", {}))
        # Use a broad default when query is empty or generic (e.g. run input {})
        if not query or query in ("{}", "null", "[]"):
            query = "summarize all documents and context for daily digest"
            use_default_query = True

        # Lower threshold for default query so we retrieve docs even with loose semantic match
        if use_default_query and min_score > 0.35:
            min_score = 0.35

        secrets = state.get("_secrets")
        if not isinstance(secrets, dict):
            secrets = None

        docs = await retrieve_documents(
            query=query,
            collection_id=collection_id,
            top_k=top_k,
            min_score=min_score,
            embedding_model=embedding_model,
            secrets=secrets,
        )
        return {"documents": docs, "count": len(docs)}


register(RAGRetrieverPlugin())
