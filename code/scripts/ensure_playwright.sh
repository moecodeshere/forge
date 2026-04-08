#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
PW_PATH="$ROOT_DIR/.playwright-browsers"

if [[ -n "${PLAYWRIGHT_EXECUTABLE_PATH:-}" && -x "${PLAYWRIGHT_EXECUTABLE_PATH}" ]]; then
  echo "Using system browser at $PLAYWRIGHT_EXECUTABLE_PATH"
  exit 0
fi

mkdir -p "$PW_PATH"

(
  cd "$WEB_DIR"
  PLAYWRIGHT_BROWSERS_PATH="$PW_PATH" \
    COREPACK_HOME="$ROOT_DIR/.corepack" \
    corepack pnpm exec playwright install chromium
)

echo "Playwright browsers ready at $PW_PATH"

