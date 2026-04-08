import pytest

from app.services.dag_validator import DAGValidationError, validate_graph_is_dag


def test_validate_graph_accepts_dag() -> None:
    graph = {
        "nodes": [{"id": "a"}, {"id": "b"}, {"id": "c"}],
        "edges": [{"source": "a", "target": "b"}, {"source": "b", "target": "c"}],
    }
    validate_graph_is_dag(graph)


def test_validate_graph_rejects_cycle() -> None:
    graph = {
        "nodes": [{"id": "a"}, {"id": "b"}],
        "edges": [{"source": "a", "target": "b"}, {"source": "b", "target": "a"}],
    }
    with pytest.raises(DAGValidationError):
        validate_graph_is_dag(graph)
