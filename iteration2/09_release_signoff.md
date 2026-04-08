# Release Sign-off (Iteration2)

Use this page to close the remaining manual/runtime-dependent gates.

## Automated evidence already available

- `pnpm release:check` passes for API + web suites (double-pass).
- `pnpm load:baseline` passes with artifact:
  - `iteration2/artifacts/load_baseline_public_summary.json`
  - latest `p95_overall_ms`: `15.26`
  - latest `failure_rate`: `0.0`
- Canvas medium-graph responsiveness test is in:
  - `code/apps/web/__tests__/canvas-performance.test.ts`

## Final manual close-out steps

1. Export E2E credentials (or keep Supabase seed env configured):
   - `E2E_EMAIL=...`
   - `E2E_PASSWORD=...`
2. Run:
   - `pnpm release:check`
3. Confirm E2E test `signup/login -> template -> edit -> run -> inspect logs` passes.
4. Confirm elapsed time gate in E2E remains below 10 minutes.
5. Perform a final bug triage pass for P0/P1 items and mark outcome.

## Final gates to mark complete in `06_acceptance_checklist.md`

- `New user can start from template without reading documentation`
- `Time to first successful workflow run is under 10 minutes`
- `E2E journey passes: signup -> template -> edit -> run -> inspect logs`
- `No open P0/P1 bugs for iteration2 scope`
- `Release checklist sign-off completed`

