"""
Safe expression evaluator for ConditionalBranch nodes.
Uses simpleeval to prevent arbitrary code execution.
Expressions can reference any key in the node's input context.

Examples
--------
    evaluate("score > 0.8", {"score": 0.9})   → True
    evaluate("role == 'admin'", {"role": "admin"})  → True
    evaluate("len(items) > 3", {"items": [1, 2, 3, 4]})  → True
"""
from __future__ import annotations

from typing import Any

import structlog

log = structlog.get_logger(__name__)

_SIMPLEEVAL_AVAILABLE = False
try:
    from simpleeval import EvalWithCompoundTypes, InvalidExpression  # type: ignore

    _SIMPLEEVAL_AVAILABLE = True
except ImportError:
    pass


def evaluate_condition(expression: str, context: dict[str, Any]) -> bool:
    """
    Evaluate a boolean expression safely.

    Raises ValueError for syntax errors or unsafe operations.
    """
    if not expression.strip():
        raise ValueError("Empty expression")

    if not _SIMPLEEVAL_AVAILABLE:
        # Minimal fallback: only 'true' / 'false' literals
        lower = expression.strip().lower()
        if lower in ("true", "1"):
            return True
        if lower in ("false", "0"):
            return False
        raise ValueError(
            "simpleeval not installed; only literal true/false supported in fallback"
        )

    try:
        evaluator = EvalWithCompoundTypes(names=context)
        result = evaluator.eval(expression)
        log.debug("condition_evaluated", expr=expression, result=result)
        return bool(result)
    except InvalidExpression as exc:
        raise ValueError(f"Invalid expression '{expression}': {exc}") from exc
    except Exception as exc:
        raise ValueError(f"Expression evaluation failed: {exc}") from exc


def pick_branch(
    *,
    expression: str,
    context: dict[str, Any],
    true_branch_id: str,
    false_branch_id: str,
) -> str:
    """Return the target node ID for the winning branch."""
    result = evaluate_condition(expression, context)
    return true_branch_id if result else false_branch_id
