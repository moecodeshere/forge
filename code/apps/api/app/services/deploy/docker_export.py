"""
Docker export — generate Dockerfile + docker-compose.yml for the graph.
"""
from __future__ import annotations

from typing import Any

DOCKERFILE_TEMPLATE = """\
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

# Run the LangGraph workflow (python main.py)
CMD ["python", "main.py"]
"""

DOCKER_COMPOSE_TEMPLATE = """\
version: "3.9"
services:
  graph:
    build: .
    env_file: .env
    environment:
      - OPENAI_API_KEY=${{OPENAI_API_KEY}}
      - ANTHROPIC_API_KEY=${{ANTHROPIC_API_KEY}}
      - GOOGLE_API_KEY=${{GOOGLE_API_KEY}}
    restart: unless-stopped
"""

ENV_EXAMPLE = """\
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
"""


def generate_dockerfile(_graph_content: dict[str, Any]) -> str:
    return DOCKERFILE_TEMPLATE


def generate_docker_compose(_graph_content: dict[str, Any], graph_name: str) -> str:
    return DOCKER_COMPOSE_TEMPLATE.replace("graph:", f"{graph_name.lower().replace(' ', '-')}:")


def generate_env_example(_graph_content: dict[str, Any]) -> str:
    return ENV_EXAMPLE
