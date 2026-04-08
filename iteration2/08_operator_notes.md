# Operator Notes and Fallbacks

## Runtime prerequisites

- Web app running on `http://localhost:3000`
- API running on `http://localhost:8000`
- Supabase credentials configured in env files
- Redis available for execution streaming and rate-limit windows

## Common failure modes and fallback actions

## 1) CSP blocks API calls from dashboard/canvas
- Symptom: browser console shows `Refused to connect ... violates Content Security Policy`
- Action:
  1. Verify `NEXT_PUBLIC_API_URL=http://localhost:8000`
  2. Restart web server after `next.config.ts` changes
  3. Hard-refresh browser

## 2) Graph autosave fails
- Symptom: `Autosave failed. Check API/auth setup.`
- Action:
  1. Confirm user session is valid (log out/in)
  2. Verify API health endpoint `/healthz`
  3. Check `/graphs` route from API docs

## 3) Execution stream disconnects
- Symptom: run starts but status updates pause
- Action:
  1. Confirm Redis is reachable
  2. Retry run
  3. Inspect API logs for websocket close/error events

## 4) Integration action fails
- Symptom: integration node returns unsupported action or auth error
- Action:
  1. Check node config (`provider`, `action`, `params`)
  2. Run in `test_mode=true` first
  3. Add provider token env values for connected stub mode

## Release runbook checks

- API tests:
  - `pytest -q tests/test_monitoring.py tests/test_rate_limit.py tests/test_ai_builder_router.py tests/test_integrations_router.py tests/test_execution.py tests/test_graphs_router.py tests/test_health.py`
- Web tests:
  - `pnpm --filter web test`
- E2E:
  - `pnpm release:check` (auto-runs API + web tests and attempts E2E with provided or auto-seeded creds)
  - Uses system Chrome automatically when available to avoid flaky Playwright browser cache paths.
- Load baseline:
  - `pnpm load:baseline` (writes summary to `iteration2/artifacts/load_baseline_public_summary.json`)
- Latest baseline (automated):
  - `p95_overall_ms`: 15.26
  - `failure_rate`: 0.0
  - Source: `iteration2/artifacts/load_baseline_public_summary.json`
- If E2E is skipped:
  1. Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist in `code/.env` for auto-seeding, or set `E2E_EMAIL` and `E2E_PASSWORD`.
  2. Re-run `pnpm release:check`.
- If TLS interception breaks seed/download calls:
  1. Install your org root certificate into system trust store.
  2. Export `CURL_CA_BUNDLE` and `NODE_EXTRA_CA_CERTS` to that cert path.
  3. Re-run sign-off flow.

