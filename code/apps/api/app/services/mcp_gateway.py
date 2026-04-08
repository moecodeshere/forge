"""
MCP (Model Context Protocol) gateway.
- Registry search: cached 5 min in Redis (key mcp:search:{q})
- Manifest fetch: cached 1 h in Redis (key mcp:manifest:{url_hash})
- Timeout: ≤ 5 s per HTTP call
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
from urllib.parse import urlparse
from typing import Any

import httpx
import redis.asyncio as aioredis
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

SEARCH_TTL = 300   # 5 minutes
MANIFEST_TTL = 3600  # 1 hour
HTTP_TIMEOUT = 5.0

# Default public MCP registry (can be overridden via env)
MCP_REGISTRY_URL = "https://registry.smithery.ai"


def _is_private_host(host: str) -> bool:
    host_lower = host.strip().lower()
    if host_lower in {"localhost", "127.0.0.1", "::1"}:
        return True
    try:
        ip = ipaddress.ip_address(host_lower)
        return ip.is_loopback or ip.is_private or ip.is_link_local
    except ValueError:
        return False


async def _get_redis() -> aioredis.Redis:
    return await aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def search_tools(query: str, limit: int = 20) -> list[dict[str, Any]]:
    """Search the MCP registry and return tool listings."""
    redis = await _get_redis()
    cache_key = f"mcp:search:{hashlib.sha1(query.encode()).hexdigest()}:{limit}"

    cached = await redis.get(cache_key)
    if cached:
        await redis.aclose()
        result: list[dict[str, Any]] = json.loads(cached)
        return result

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                f"{MCP_REGISTRY_URL}/servers",
                params={"q": query, "limit": limit},
            )
            resp.raise_for_status()
            data: list[dict[str, Any]] = resp.json().get("servers", resp.json()) if isinstance(resp.json(), dict) else resp.json()
    except Exception as exc:
        log.warning("mcp_search_failed", query=query, error=str(exc))
        data = []

    await redis.setex(cache_key, SEARCH_TTL, json.dumps(data))
    await redis.aclose()
    return data


async def fetch_manifest(server_url: str) -> dict[str, Any]:
    """Fetch and cache the MCP server manifest (tools list + schema)."""
    parsed = urlparse(server_url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("server_url must use http or https")
    if not parsed.hostname:
        raise ValueError("server_url is invalid")
    if _is_private_host(parsed.hostname):
        raise ValueError("server_url points to a private/localhost address")

    redis = await _get_redis()
    url_hash = hashlib.sha1(server_url.encode()).hexdigest()
    cache_key = f"mcp:manifest:{url_hash}"

    cached = await redis.get(cache_key)
    if cached:
        await redis.aclose()
        manifest: dict[str, Any] = json.loads(cached)
        return manifest

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(f"{server_url.rstrip('/')}/manifest.json")
            resp.raise_for_status()
            manifest = resp.json()
    except Exception as exc:
        log.warning("mcp_manifest_fetch_failed", server_url=server_url, error=str(exc))
        manifest = {}

    await redis.setex(cache_key, MANIFEST_TTL, json.dumps(manifest))
    await redis.aclose()
    return manifest
