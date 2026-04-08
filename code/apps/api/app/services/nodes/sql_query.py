"""
SQL / Database node plugin.
Run a parameterized SQL query (Postgres via asyncpg or Supabase).
Uses DATABASE_URL from secrets for raw SQL, or Supabase table for simple reads.
"""
from __future__ import annotations

from typing import Any

from app.services.expressions import evaluate_expression
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


def _build_expr_context(state: dict[str, Any]) -> dict[str, Any]:
    inp = state.get("_input", {})
    node_outputs = state.get("_node_outputs", {})
    return {"input": inp, **node_outputs}


class SqlQueryPlugin:
    meta = NodePluginMeta(
        type="sql_query",
        category="data",
        label="SQL Query",
        description="Run a parameterized SQL query (Postgres). Uses DATABASE_URL from Run settings.",
        inputs=["query", "params"],
        outputs=["rows", "row_count", "affected_rows"],
        config_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "SQL with {{param}} placeholders"},
                "params": {"type": "object", "description": "Key-value params for the query"},
            },
        },
        ui_schema={
            "query": {"widget": "textarea", "placeholder": "SELECT * FROM leads WHERE status = $1"},
            "params": {"widget": "json"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        secrets = state.get("_secrets") or {}
        expr_ctx = _build_expr_context(state)

        query_raw = cfg.get("query", "").strip()
        if not query_raw:
            return {"rows": [], "row_count": 0, "affected_rows": 0, "error": "Query is required"}

        query = (
            evaluate_expression(query_raw, expr_ctx)
            if isinstance(query_raw, str)
            else str(query_raw)
        )
        params_config = cfg.get("params")
        params: list[Any] = []
        if isinstance(params_config, list):
            for v in params_config:
                if isinstance(v, str):
                    v = evaluate_expression(v, expr_ctx)
                params.append(v)
        elif isinstance(params_config, dict):
            for k in sorted(params_config.keys()):
                v = params_config[k]
                if isinstance(v, str):
                    v = evaluate_expression(v, expr_ctx)
                params.append(v)

        database_url = (secrets.get("DATABASE_URL") or secrets.get("database_url") or "").strip()
        if database_url:
            try:
                import asyncpg
            except ImportError:
                return {
                    "rows": [],
                    "row_count": 0,
                    "affected_rows": 0,
                    "error": "asyncpg not installed; pip install asyncpg",
                }
            try:
                conn = await asyncpg.connect(database_url)
                try:
                    upper = query.strip().upper()
                    if upper.startswith("SELECT") or upper.startswith("WITH"):
                        rows = await conn.fetch(query, *params)
                        result = [dict(r) for r in rows]
                        return {"rows": result, "row_count": len(result), "affected_rows": 0}
                    else:
                        result = await conn.execute(query, *params)
                        affected = int(result.split()[-1]) if result and result.split() else 0
                        return {"rows": [], "row_count": 0, "affected_rows": affected}
                finally:
                    await conn.close()
            except Exception as e:
                return {
                    "rows": [],
                    "row_count": 0,
                    "affected_rows": 0,
                    "error": str(e),
                }

        from app.services.supabase import get_supabase_admin_client
        supabase = get_supabase_admin_client()
        table_name = (cfg.get("table") or "").strip() or None
        if table_name:
            try:
                resp = supabase.table(table_name).select("*").execute()
                data = list(resp.data or [])
                return {"rows": data, "row_count": len(data), "affected_rows": 0}
            except Exception as e:
                return {
                    "rows": [],
                    "row_count": 0,
                    "affected_rows": 0,
                    "error": str(e),
                }

        return {
            "rows": [],
            "row_count": 0,
            "affected_rows": 0,
            "error": "Set DATABASE_URL in Run settings for raw SQL, or set 'table' in config for Supabase table read.",
        }


register(SqlQueryPlugin())
