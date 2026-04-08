from __future__ import annotations

from app.services.ai import templates
from app.services.dag_validator import validate_graph_is_dag, validate_has_single_trigger


def _graph_from_suggestion(suggestion: templates.TemplateSuggestion) -> dict:
  return {"nodes": suggestion.nodes, "edges": suggestion.edges}


def test_email_digest_template_is_valid_dag() -> None:
  suggestion = templates.build_email_digest_template()
  graph = _graph_from_suggestion(suggestion)
  validate_graph_is_dag(graph)
  validate_has_single_trigger(graph)


def test_rag_chat_template_is_valid_dag() -> None:
  suggestion = templates.build_rag_chat_template()
  graph = _graph_from_suggestion(suggestion)
  validate_graph_is_dag(graph)
  validate_has_single_trigger(graph)


def test_news_summary_template_is_valid_dag() -> None:
  suggestion = templates.build_news_summary_template()
  graph = _graph_from_suggestion(suggestion)
  validate_graph_is_dag(graph)
  validate_has_single_trigger(graph)


def test_weather_digest_template_is_valid_dag() -> None:
  suggestion = templates.build_weather_digest_template()
  graph = _graph_from_suggestion(suggestion)
  validate_graph_is_dag(graph)
  validate_has_single_trigger(graph)


def test_lead_qualification_template_is_valid_dag() -> None:
  suggestion = templates.build_lead_qualification_template()
  graph = _graph_from_suggestion(suggestion)
  validate_graph_is_dag(graph)
  validate_has_single_trigger(graph)


def test_invoice_processing_template_is_valid_dag() -> None:
  suggestion = templates.build_invoice_processing_template()
  graph = _graph_from_suggestion(suggestion)
  validate_graph_is_dag(graph)
  validate_has_single_trigger(graph)

