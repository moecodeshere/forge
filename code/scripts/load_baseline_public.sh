#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
ARTIFACT_DIR="$ROOT_DIR/../iteration2/artifacts"
SUMMARY_PATH="$ARTIFACT_DIR/load_baseline_public_summary.json"

mkdir -p "$ARTIFACT_DIR"

API_PID=""
STARTED_API=0

cleanup() {
  if [[ "$STARTED_API" -eq 1 && -n "$API_PID" ]]; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! curl -fsS "http://localhost:8000/healthz" >/dev/null 2>&1; then
  (
    cd "$API_DIR"
    source .venv/bin/activate
    uvicorn app.main:app --host 127.0.0.1 --port 8000 >/tmp/forge_load_baseline_api.log 2>&1
  ) &
  API_PID="$!"
  STARTED_API=1
fi

for _ in {1..25}; do
  if curl -fsS "http://localhost:8000/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://localhost:8000/healthz" >/dev/null 2>&1; then
  echo "API did not become healthy for load baseline." >&2
  exit 1
fi

python3 "$ROOT_DIR/scripts/load_baseline_public.py" "http://localhost:8000" "$SUMMARY_PATH"
echo "Saved load summary to $SUMMARY_PATH"

