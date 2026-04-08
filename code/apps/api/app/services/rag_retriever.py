"""
RAG retriever: pgvector cosine similarity search via Supabase RPC.
top_k ≤ 20, min_score ≥ 0.65 (configurable per node).
Embeddings produced by LiteLLM (defaults to text-embedding-3-small).
"""
from __future__ import annotations

from typing import Any

import structlog

from app.services.llm_caller import get_embedding
from app.services.supabase import get_supabase_admin_client

log = structlog.get_logger(__name__)

MIN_SCORE_FLOOR = 0.0
MAX_TOP_K = 20


async def retrieve_documents(
    *,
    query: str,
    collection_id: str | None = None,
    top_k: int = 5,
    min_score: float = 0.65,
    embedding_model: str = "text-embedding-3-small",
    secrets: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Return ranked document chunks similar to query. Uses secrets for embedding API key if provided."""
    top_k = min(top_k, MAX_TOP_K)
    min_score = max(min_score, MIN_SCORE_FLOOR)

    embedding = get_embedding(query, model=embedding_model, secrets=secrets)

    supabase = get_supabase_admin_client()

    params: dict[str, Any] = {
        "query_embedding": embedding,
        "match_count": top_k,
        "match_threshold": min_score,
    }
    if collection_id:
        params["collection_id"] = collection_id

    # match_documents: no collection filter (finds all docs)
    # match_documents_with_collection: filters by collection_id
    rpc_fn = "match_documents_with_collection" if collection_id else "match_documents"

    try:
        response = supabase.rpc(rpc_fn, params).execute()
        docs: list[dict[str, Any]] = response.data or []
        # If threshold filtered everything out, retry with minimal threshold so we return something
        if len(docs) == 0 and min_score > 0.01:
            fallback_params = {**params, "match_threshold": 0.01}
            response = supabase.rpc(rpc_fn, fallback_params).execute()
            docs = response.data or []
            if docs:
                log.info(
                    "rag_retrieved_fallback",
                    query_prefix=query[:80],
                    count=len(docs),
                    original_threshold=min_score,
                )
        if not docs:
            try:
                any_row = supabase.table("documents").select("id").limit(1).execute()
                table_count = len(any_row.data or [])
                log.warning(
                    "rag_zero_docs",
                    query_prefix=query[:80],
                    rpc_fn=rpc_fn,
                    threshold=min_score,
                    documents_table_has_rows=table_count > 0,
                    hint="If documents_table_has_rows is False, ingest to same Supabase the API uses.",
                )
            except Exception as e:
                log.warning("rag_zero_docs", query_prefix=query[:80], table_check_error=str(e))
        else:
            log.info("rag_retrieved", query_prefix=query[:80], count=len(docs))
        return docs
    except Exception as exc:
        log.error("rag_retrieval_failed", error=str(exc))
        raise


async def ingest_document_chunks(
    *,
    user_id: str,
    collection_id: str,
    chunks: list[str],
    metadata: dict[str, Any] | None = None,
    embedding_model: str = "text-embedding-3-small",
    api_key: str | None = None,
    secrets: dict[str, str] | None = None,
) -> int:
    """Embed and insert document chunks. Returns count inserted. Uses api_key or secrets for embedding if provided."""
    supabase = get_supabase_admin_client()
    rows: list[dict[str, Any]] = []

    for i, chunk in enumerate(chunks):
        emb = get_embedding(
            chunk,
            model=embedding_model,
            api_key=api_key,
            secrets=secrets,
        )
        rows.append(
            {
                "user_id": user_id,
                "collection_id": collection_id,
                "content": chunk,
                "embedding": emb,
                "metadata": {**(metadata or {}), "chunk_index": i},
            }
        )

    supabase.table("documents").insert(rows).execute()
    log.info("chunks_ingested", count=len(rows), collection_id=collection_id)
    return len(rows)
