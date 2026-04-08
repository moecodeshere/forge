"""
In-memory approval gates for ApprovalStep nodes.
Extracted to avoid circular imports between execution and node plugins.
"""
from __future__ import annotations

import asyncio
from typing import Any

_APPROVAL_GATES: dict[str, asyncio.Event] = {}
_APPROVAL_RESULTS: dict[str, dict[str, Any]] = {}


def get_gate(run_id: str) -> asyncio.Event | None:
    return _APPROVAL_GATES.get(run_id)


def set_gate(run_id: str, gate: asyncio.Event) -> None:
    _APPROVAL_GATES[run_id] = gate


def pop_gate(run_id: str) -> asyncio.Event | None:
    return _APPROVAL_GATES.pop(run_id, None)


def set_result(run_id: str, result: dict[str, Any]) -> None:
    _APPROVAL_RESULTS[run_id] = result


def pop_result(run_id: str) -> dict[str, Any]:
    return _APPROVAL_RESULTS.pop(run_id, {"approved": False})


def resolve_approval(run_id: str, approved: bool, feedback: str | None = None) -> bool:
    """Signal an approval gate. Returns False if no gate exists."""
    gate = _APPROVAL_GATES.get(run_id)
    if gate is None:
        return False
    _APPROVAL_RESULTS[run_id] = {"approved": approved, "feedback": feedback}
    gate.set()
    return True
