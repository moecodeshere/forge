from __future__ import annotations

import time
from typing import Any

import networkx as nx

TRIGGER_TYPES = frozenset({
    "manual_trigger",
    "webhook_trigger",
    "schedule_trigger",
    "form_submission_trigger",
    "app_event_trigger",
})
# Legacy: allow non-trigger nodes as entry for backward compat with existing graphs
LEGACY_ENTRY_TYPES = frozenset(
    {"llm_caller", "rag_retriever", "conditional_branch", "mcp_tool", "approval_step", "set_node"}
)


class DAGValidationError(ValueError):
    pass


def _get_sources_and_graph(
    graph_content: dict[str, Any],
) -> tuple[list[str], nx.DiGraph, dict[str, dict]]:
    nodes = graph_content.get("nodes", [])
    edges = graph_content.get("edges", [])

    graph = nx.DiGraph()
    node_by_id: dict[str, dict] = {}

    for node in nodes:
        node_id = node.get("id")
        if isinstance(node_id, str) and node_id:
            graph.add_node(node_id)
            node_by_id[node_id] = node

    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if isinstance(source, str) and isinstance(target, str):
            graph.add_edge(source, target)

    sources = [n for n in graph.nodes() if graph.in_degree(n) == 0]
    return sources, graph, node_by_id


def validate_graph_is_dag(graph_content: dict[str, Any]) -> None:
    """
    Validate that graph_content (nodes + edges) is a DAG.
    SRS target: cycle detection <= 50ms for 100 nodes.
    """
    sources, graph, _ = _get_sources_and_graph(graph_content)

    start = time.perf_counter()
    is_dag = nx.is_directed_acyclic_graph(graph)
    elapsed_ms = (time.perf_counter() - start) * 1000

    if not is_dag:
        try:
            cycle_edges = list(nx.find_cycle(graph))
            _, _, node_by_id = _get_sources_and_graph(graph_content)
            node_ids_in_cycle = list(dict.fromkeys(e[0] for e in cycle_edges))
            labels = []
            for nid in node_ids_in_cycle:
                node = node_by_id.get(nid, {})
                label = (node.get("data") or {}).get("label") or nid
                labels.append(str(label))
            if labels:
                raise DAGValidationError(
                    "Cycle detected between nodes "
                    + ", ".join(labels)
                    + ". Remove a connection so the graph flows in one direction."
                )
        except nx.NetworkXNoCycle:
            pass
        raise DAGValidationError(
            "Graph contains a cycle. Remove a connection so the graph flows in one direction."
        )

    # Keep this guard for early performance regressions in CI.
    if graph.number_of_nodes() <= 100 and elapsed_ms > 50:
        raise DAGValidationError(
            f"Cycle detection exceeded 50ms budget ({elapsed_ms:.2f}ms)"
        )


def validate_has_single_trigger(graph_content: dict[str, Any]) -> None:
    """
    Validate that the graph has exactly one trigger (entry) node.
    The source node's type must be a trigger or legacy entry type.
    """
    sources, _, node_by_id = _get_sources_and_graph(graph_content)

    if not sources:
        return  # Empty graph
    if len(sources) > 1:
        raise DAGValidationError(
            "Graph must have exactly one trigger (entry) node. "
            "Use a trigger node (Manual, Webhook, Schedule, Form, or App Event) as the workflow start."
        )

    trigger_id = sources[0]
    node = node_by_id.get(trigger_id, {})
    node_type = str(node.get("type", "")).strip()

    allowed = TRIGGER_TYPES | LEGACY_ENTRY_TYPES
    allowed = TRIGGER_TYPES | LEGACY_ENTRY_TYPES | {"simple_llm", "http_request"}
    if node_type and node_type not in allowed:
        raise DAGValidationError(
            f"Trigger node must be a trigger type (manual_trigger, webhook_trigger, schedule_trigger, "
            f"form_submission_trigger, app_event_trigger). Found: {node_type}"
        )
