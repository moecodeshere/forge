# Sequential Task List (Execution Order)

This is the single, strict execution order for iteration2, with mandatory double-test gates.

## Current execution status

- Completed and validated with two automated passes:
  - 0) Environment and baseline lock (automated health/CSP validations)
  - 1) Reliability unblockers (I2-A-01..I2-A-04)
  - 2) Beginner-first onboarding UX (I2-B-01..I2-B-04)
- 3) Execution clarity and debugging UX (I2-C-01..I2-C-04)
- In progress:
  - 4) Integrations and AI assist (I2-D-01..I2-D-06 complete in current implementation pass)
  - 5) Hardening and release readiness (I2-E-01..I2-E-03 complete and validated with baseline artifact; I2-E-04 includes full-path E2E spec + release seeding automation, with final login E2E pending local credential/network availability)

## Global rule

- After each implementation block, run **Test Pass 1** (automated + manual smoke), fix issues, then run **Test Pass 2** (repeat full checks from clean restart/session).
- Do not move to next block until both passes are green.

## 0) Environment and baseline lock

1. Confirm local env files are aligned (`code/.env`, `apps/web/.env.local`, `apps/api/.env`).
2. Start backend and frontend from clean terminals.
3. Capture baseline failures in dashboard/canvas for comparison.
4. Freeze baseline in a short changelog note.

Test Pass 1:
- `GET /healthz` returns 200.
- Dashboard is reachable.

Test Pass 2:
- Restart both services and confirm the same baseline behavior.

## 1) Reliability unblockers (Sequence A)

5. **I2-A-01**: Validate and finalize `content <-> json_content` mapping in `code/apps/api/app/routers/graphs.py`.
6. **I2-A-02**: Harden web graph API error surfaces in `code/apps/web/lib/api/graphs.ts`.
7. **I2-A-03**: Finalize CSP for dev/prod API+WS in `code/apps/web/next.config.ts`.
8. **I2-A-04**: Recheck auth middleware and route protections in `code/apps/web/middleware.ts` and auth pages.

Test Pass 1:
- Register/login works.
- Dashboard graph list loads (no CSP block).
- Create graph and autosave succeeds once.

Test Pass 2:
- Full service restart, hard refresh, repeat same flow.
- Confirm no regressions in auth or CSP behavior.

## 2) Beginner-first onboarding UX (Sequence B)

9. **I2-B-01**: Implement template model and seed templates (`code/apps/web/lib/templates/*`).
10. **I2-B-02**: Add template picker in dashboard (`code/apps/web/app/dashboard/page.tsx`).
11. **I2-B-03**: Implement simple/advanced node config modes (`code/apps/web/components/panels/NodeConfigPanel.tsx`).
12. **I2-B-04**: Improve node palette discoverability (`code/apps/web/components/canvas/NodePalette.tsx`).

Test Pass 1:
- User can start from template and save graph.
- Simple mode fields are understandable and validated.

Test Pass 2:
- New account flow: template -> edit -> save -> reload graph.
- Confirm palette filters/search still work.

## 3) Execution clarity and debugging UX (Sequence C)

13. **I2-C-01**: Add node-level test/run controls (`code/apps/web/components/canvas/FlowCanvas.tsx`).
14. **I2-C-02**: Upgrade execution timeline and previews (`code/apps/web/components/panels/ExecutionLogPanel.tsx`).
15. **I2-C-03**: Add friendly remediation messages for failures (execution + API errors).
16. **I2-C-04**: Improve and validate WS reconnect/run lifecycle (`code/apps/web/lib/hooks/useExecution.ts`).

Test Pass 1:
- Run full flow and verify event order.
- Simulate failure and verify actionable error messages.

Test Pass 2:
- Force reconnect scenario (refresh mid-run) and validate state recovery.
- Repeat run from clean load.

## 4) Integrations and AI assist (Sequence D)

17. **I2-D-01**: Build integration abstraction scaffold (`code/apps/api/app/services/integrations/*`).
18. **I2-D-02**: Implement Slack integration v1.
19. **I2-D-03**: Implement Gmail integration v1.
20. **I2-D-04**: Implement Sheets integration v1.
21. **I2-D-05**: Implement Notion integration v1.
22. **I2-D-06**: Implement AI workflow suggestion prototype (`FlowCanvas` + API endpoint).

Test Pass 1:
- One happy-path template per integration executes successfully.
- AI suggestion creates valid graph skeleton.

Test Pass 2:
- Repeat all integration flows with fresh credentials/session.
- Validate error handling paths for auth/token expiry.

## 5) Hardening and release readiness (Sequence E)

23. **I2-E-01**: Validate observability and core metrics (`code/apps/api/app/core/monitoring.py`).
24. **I2-E-02**: Validate/enforce rate limits (`code/apps/api/app/core/rate_limit.py`).
25. **I2-E-03**: Tune and document load baseline (`code/k6/load_test.js`).
26. **I2-E-04**: Run final E2E release gate and manual QA sign-off.

Test Pass 1:
- Full E2E path: signup -> template -> edit -> run -> inspect logs -> integration action.
- Load baseline captured and documented.

Test Pass 2:
- Repeat full E2E from clean environment.
- Confirm no P0/P1 issues remain open.

## 6) Completion gate (must all be true)

27. All items in `iteration2/06_acceptance_checklist.md` are checked.
28. Final regression run is green after restart.
29. Iteration notes updated with known limitations and next backlog.
30. Final manual release sign-off recorded in `iteration2/09_release_signoff.md`.
