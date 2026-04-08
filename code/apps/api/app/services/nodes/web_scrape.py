"""
Web Scrape node — fetch a URL and return markdown or structured content (Firecrawl).
Input: url from state or config. Output: markdown, json, or raw content.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register

FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape"


class WebScrapePlugin:
    meta = NodePluginMeta(
        type="web_scrape",
        category="data",
        label="Web Scrape",
        description="Crawl a URL and get clean markdown or JSON (Firecrawl). Use for docs, articles, or training data.",
        inputs=["url"],
        outputs=["markdown", "metadata", "content"],
        config_schema={
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "format": {"type": "string", "default": "markdown"},
            },
        },
        ui_schema={
            "url": {"widget": "text", "placeholder": "https://example.com"},
            "format": {"widget": "text", "placeholder": "markdown or json"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        url_config = str(cfg.get("url") or "").strip()
        fmt = str(cfg.get("format") or "markdown").strip().lower() or "markdown"
        merged = state.get("_input") or state
        url = (
            url_config
            or merged.get("url")
            or merged.get("link")
            or (merged.get("body", {}).get("url") if isinstance(merged.get("body"), dict) else None)
        )
        url = str(url or "").strip()
        if not url:
            return {
                "markdown": "",
                "metadata": {},
                "content": None,
                "error": "No URL provided. Set 'url' in config or pass url in run input.",
            }
        secrets = state.get("_secrets") or {}
        if not isinstance(secrets, dict):
            secrets = {}
        api_key = (secrets.get("FIRECRAWL_API_KEY") or secrets.get("firecrawl_api_key") or "").strip()
        if not api_key:
            return {
                "markdown": "",
                "metadata": {"url": url},
                "content": None,
                "error": "FIRECRAWL_API_KEY not set. Add it in Run settings to scrape live.",
            }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                FIRECRAWL_SCRAPE_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"url": url, "formats": [fmt]},
                timeout=60.0,
            )
        if resp.status_code != 200:
            err = resp.json() if resp.text else {}
            msg = err.get("error", resp.text or f"Firecrawl error {resp.status_code}")
            return {"markdown": "", "metadata": {"url": url}, "content": None, "error": str(msg)}
        data = resp.json()
        success = data.get("success")
        if not success:
            return {
                "markdown": "",
                "metadata": {"url": url},
                "content": None,
                "error": data.get("error", "Scrape failed"),
            }
        result = data.get("data", {})
        markdown = result.get("markdown", "")
        metadata = result.get("metadata", {})
        return {"markdown": markdown, "metadata": metadata, "content": markdown, "url": url}


register(WebScrapePlugin())
