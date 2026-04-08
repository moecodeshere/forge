"""
Expression engine for workflow node configs.
Supports {{input.x}}, {{nodeId.output.key}} style references to upstream data.
"""
from __future__ import annotations

import re
from typing import Any


_EXPR_PATTERN = re.compile(r"\{\{([^}]+)\}\}")


def _get_path(obj: Any, path: str) -> Any:
    """Resolve dot path like 'input.email' or 'nodeA.output.result' against obj."""
    parts = path.strip().split(".")
    current: Any = obj
    for part in parts:
        if current is None:
            return None
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, (list, tuple)):
            try:
                idx = int(part)
                current = current[idx] if 0 <= idx < len(current) else None
            except ValueError:
                return None
        else:
            return None
    return current


def evaluate_expression(template: str, context: dict[str, Any]) -> Any:
    """
    Replace {{path}} expressions in template with values from context.
    Returns the resolved value (string if template, or raw value if single expression).

    Context format: {"input": merged_input, "nodeId": node_output, ...}

    Examples:
        evaluate_expression("Hello {{input.name}}", {"input": {"name": "World"}})
        -> "Hello World"
        evaluate_expression("{{input.email}}", {"input": {"email": "a@b.com"}})
        -> "a@b.com"
        evaluate_expression("{{nodeA.output.result}}", {"nodeA": {"output": {"result": 42}}})
        -> 42
    """
    matches = list(_EXPR_PATTERN.finditer(template))
    if not matches:
        return template

    # Single full-match: return raw value
    if len(matches) == 1 and matches[0].group(0) == template.strip():
        path = matches[0].group(1).strip()
        val = _get_path(context, path)
        return "" if val is None else val

    # Multiple or partial: string replacement
    result = template
    for m in reversed(matches):
        path = m.group(1).strip()
        val = _get_path(context, path)
        replacement = "" if val is None else str(val)
        result = result[: m.start()] + replacement + result[m.end() :]
    return result


def has_expressions(template: str) -> bool:
    """Return True if template contains {{...}} expressions."""
    return bool(_EXPR_PATTERN.search(template))
