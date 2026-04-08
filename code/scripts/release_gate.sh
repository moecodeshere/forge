#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
PW_PATH="$ROOT_DIR/.playwright-browsers"
SYSTEM_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
API_PID=""
STARTED_API=0

cleanup() {
  if [[ "$STARTED_API" -eq 1 && -n "$API_PID" ]]; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

start_api_if_needed() {
  if curl -fsS "http://localhost:8000/healthz" >/dev/null 2>&1; then
    return
  fi

  (
    cd "$API_DIR"
    source .venv/bin/activate
    uvicorn app.main:app --host 127.0.0.1 --port 8000 >/tmp/forge_release_api.log 2>&1
  ) &
  API_PID="$!"
  STARTED_API=1

  for _ in {1..25}; do
    if curl -fsS "http://localhost:8000/healthz" >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done

  echo "API did not become healthy for E2E run." >&2
  exit 1
}

seed_e2e_creds_if_needed() {
  if [[ -n "${E2E_EMAIL:-}" && -n "${E2E_PASSWORD:-}" ]]; then
    return
  fi

  if [[ -f "$ROOT_DIR/.env" ]]; then
    # shellcheck disable=SC1090
    source "$ROOT_DIR/.env"
  fi

  if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    return
  fi

  local seeded
  if ! seeded="$(SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    bash "$ROOT_DIR/scripts/seed_e2e_user.sh" 2>/dev/null)"; then
    echo "E2E seeding unavailable in current environment; continuing without E2E."
    return
  fi
  E2E_EMAIL="$(echo "$seeded" | awk -F= '/^E2E_EMAIL=/{print $2}')"
  E2E_PASSWORD="$(echo "$seeded" | awk -F= '/^E2E_PASSWORD=/{print $2}')"
  export E2E_EMAIL E2E_PASSWORD
}

echo "==> [1/4] API release suite"
(
  cd "$API_DIR"
  source .venv/bin/activate
  pytest -q \
    tests/test_health.py \
    tests/test_monitoring.py \
    tests/test_rate_limit.py \
    tests/test_ai_builder_router.py \
    tests/test_integrations_router.py \
    tests/test_execution.py \
    tests/test_graphs_router.py \
    tests/test_nodes_router.py
)

echo "==> [2/4] Web unit suite"
(
  cd "$ROOT_DIR"
  COREPACK_HOME="$ROOT_DIR/.corepack" corepack pnpm --filter web test
)

echo "==> [3/4] E2E suite (conditional)"
seed_e2e_creds_if_needed
if [[ -n "${E2E_EMAIL:-}" && -n "${E2E_PASSWORD:-}" ]]; then
  if [[ -x "$SYSTEM_CHROME" ]]; then
    export PLAYWRIGHT_EXECUTABLE_PATH="$SYSTEM_CHROME"
  fi
  bash "$ROOT_DIR/scripts/ensure_playwright.sh"
  start_api_if_needed
  (
    cd "$WEB_DIR"
    env -u CI PLAYWRIGHT_BROWSERS_PATH="$PW_PATH" PLAYWRIGHT_EXECUTABLE_PATH="${PLAYWRIGHT_EXECUTABLE_PATH:-}" COREPACK_HOME="$ROOT_DIR/.corepack" corepack pnpm test:e2e
  )
else
  echo "Skipping E2E: set E2E_EMAIL/E2E_PASSWORD or configure Supabase env in code/.env."
fi

echo "Release gate checks complete."

