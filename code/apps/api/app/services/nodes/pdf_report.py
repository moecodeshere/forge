"""
PDF / Report node plugin.
Generates a PDF from text or structured content. Uses reportlab.
"""
from __future__ import annotations

import base64
import io
from typing import Any

from app.services.expressions import evaluate_expression
from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


def _build_expr_context(state: dict[str, Any]) -> dict[str, Any]:
    inp = state.get("_input", {})
    node_outputs = state.get("_node_outputs", {})
    return {"input": inp, **node_outputs}


class PdfReportPlugin:
    meta = NodePluginMeta(
        type="pdf_report",
        category="actions",
        label="PDF Report",
        description="Generate a PDF from text or content. Outputs pdf_base64 and optional pdf_url if uploaded.",
        inputs=["content", "title"],
        outputs=["pdf_base64", "pdf_url", "filename"],
        config_schema={
            "type": "object",
            "properties": {
                "content_key": {"type": "string", "default": "output", "description": "Key in state for body text"},
                "title_key": {"type": "string", "default": "title"},
                "filename": {"type": "string", "default": "report.pdf"},
            },
        },
        ui_schema={
            "content_key": {"widget": "text", "placeholder": "output"},
            "title_key": {"widget": "text", "placeholder": "title"},
            "filename": {"widget": "text"},
        },
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        cfg = node.get("data", {}).get("config", {})
        expr_ctx = _build_expr_context(state)
        content_key = (cfg.get("content_key") or "output").strip() or "output"
        title_key = (cfg.get("title_key") or "title").strip() or "title"
        filename = (cfg.get("filename") or "report.pdf").strip() or "report.pdf"

        inp = state.get("_input", {})
        node_outputs = state.get("_node_outputs", {})
        content = inp.get(content_key) or node_outputs.get(content_key)
        if isinstance(content, dict):
            import json
            content = json.dumps(content, indent=2)
        content = str(content or "").strip() or "No content provided."
        title = inp.get(title_key) or node_outputs.get(title_key) or "Report"
        if isinstance(title, str) and "{{" in title:
            title = evaluate_expression(title, expr_ctx)
        title = str(title)[:200]

        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont
        except ImportError:
            return {
                "pdf_base64": "",
                "pdf_url": "",
                "filename": filename,
                "error": "reportlab not installed; pip install reportlab",
            }

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=inch, leftMargin=inch, topMargin=inch, bottomMargin=inch)
        styles = getSampleStyleSheet()
        story = []
        story.append(Paragraph(title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), styles["Title"]))
        story.append(Spacer(1, 0.2 * inch))
        for line in content.split("\n"):
            line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            story.append(Paragraph(line, styles["Normal"]))
            story.append(Spacer(1, 0.05 * inch))
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        pdf_base64 = base64.b64encode(pdf_bytes).decode("ascii")

        pdf_url = ""
        try:
            from app.core.config import settings
            from app.services.supabase import get_supabase_admin_client
            if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
                supabase = get_supabase_admin_client()
                path = f"reports/{context.run_id}_{filename}"
                supabase.storage.from_("exports").upload(path, pdf_bytes, {"content-type": "application/pdf"})
                signed = supabase.storage.from_("exports").create_signed_url(path, 3600)
                pdf_url = signed.get("signedUrl") or signed.get("path") or ""
        except Exception:
            pass

        return {"pdf_base64": pdf_base64, "pdf_url": pdf_url, "filename": filename}


register(PdfReportPlugin())
