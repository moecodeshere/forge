"""
Form Submission Trigger node plugin.
Starts workflow when a form is submitted; payload passed as input.
"""
from __future__ import annotations

from typing import Any

from app.services.nodes.base import ExecutionContext, NodePlugin, NodePluginMeta
from app.services.nodes.registry import register


class FormSubmissionTriggerPlugin:
    meta = NodePluginMeta(
        type="form_submission_trigger",
        category="triggers",
        label="Form Submission",
        description="Generate webforms and pass their responses to the workflow.",
        inputs=[],
        outputs=["form_data", "submitted_at"],
        config_schema={
            "type": "object",
            "properties": {
                "form_schema": {"type": "object", "description": "JSON Schema for form fields"},
                "webhook_path": {"type": "string", "description": "Optional path suffix for form POST"},
            },
        },
        ui_schema={"form_schema": {"widget": "json"}, "webhook_path": {"widget": "text"}},
    )

    async def execute(
        self,
        node: dict[str, Any],
        state: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        # Input is the form POST body (from webhook or manual run)
        import time
        input_data = dict(state.get("_input", {}))
        return {
            "form_data": input_data,
            "submitted_at": time.time(),
        }


register(FormSubmissionTriggerPlugin())
