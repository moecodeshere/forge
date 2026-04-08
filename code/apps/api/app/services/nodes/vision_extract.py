"""
Vision Extract node — send an image to a vision model and get structured extraction (e.g. invoice data).
Input: image_url or image_base64 from state. Output: extracted text/JSON.
"""
from __future__ import annotations

import base64
import json
from typing import Any

from app.services.llm_caller import call_llm
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


def _build_image_message(prompt: str, image_url: str | None, image_base64: str | None) -> list[dict[str, Any]]:
    content: list[Any] = [{"type": "text", "text": prompt or "Extract all relevant information from this image."}]
    if image_url:
        content.append({
            "type": "image_url",
            "image_url": {"url": image_url if image_url.startswith("http") else image_url},
        })
    elif image_base64:
        data = image_base64.split(",", 1)[-1] if "," in image_base64 else image_base64
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{data}"},
        })
    return [{"role": "user", "content": content}]


class VisionExtractPlugin:
    meta = NodePluginMeta(
        type="vision_extract",
        category="ai",
        label="Extract from Image",
        description="Send an image to a vision model and get structured data (e.g. invoice fields, form data).",
        inputs=["image_url", "image_base64", "query"],
        outputs=["output", "extracted"],
        config_schema={
            "type": "object",
            "properties": {
                "model": {"type": "string", "default": "gpt-4o-mini"},
                "system_prompt": {"type": "string"},
                "max_tokens": {"type": "integer", "default": 1024},
            },
        },
        ui_schema={
            "model": {"widget": "text", "placeholder": "gpt-4o-mini or gpt-4o"},
            "system_prompt": {"widget": "textarea", "placeholder": "Extract: vendor, amount, date, line items as JSON."},
            "max_tokens": {"widget": "number", "min": 256, "max": 4096},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        model = str(cfg.get("model") or "gpt-4o-mini").strip()
        system_prompt = str(cfg.get("system_prompt") or "").strip()
        max_tokens = int(cfg.get("max_tokens") or 1024)
        merged = state.get("_input") or state
        body = merged.get("body") if isinstance(merged.get("body"), dict) else merged
        image_url = (
            merged.get("image_url")
            or merged.get("image")
            or (body.get("image_url") if body else None)
        )
        image_base64 = (
            merged.get("image_base64")
            or merged.get("image_data")
            or (body.get("image_base64") if body else None)
        )
        query = merged.get("query") or merged.get("prompt") or (body.get("query") if body else None)
        prompt = str(query or "").strip() or "Extract all text and structured data from this image. If it looks like an invoice or form, return key fields as JSON."
        if not image_url and not image_base64:
            return {
                "output": "",
                "extracted": None,
                "error": "No image provided. Pass image_url or image_base64 in run input (e.g. from a webhook with an image).",
            }
        messages = _build_image_message(prompt, image_url, image_base64)
        secrets = state.get("_secrets") or {}
        if not isinstance(secrets, dict):
            secrets = {}
        sys = system_prompt or "You are a precise assistant. Extract structured data from images. Prefer JSON when the image contains forms, invoices, or tables."
        result = await call_llm(
            model=model,
            messages=messages,
            temperature=0.1,
            max_tokens=max_tokens,
            system_prompt=sys,
            secrets=secrets,
        )
        extracted = None
        if result.strip().startswith("{"):
            try:
                extracted = json.loads(result)
            except json.JSONDecodeError:
                pass
        return {"output": result, "extracted": extracted or result}


register(VisionExtractPlugin())
