# Forge AI Workflow Studio — Epics & Tasks

---

## Epic 1 — Project Foundation and Infrastructure (Week 1)

**Goal**: Local dev stack boots with `docker compose up`, CI pipeline passes.

- [x] **e1-t1** Init Turborepo monorepo: root `package.json`, `turbo.json`, `pnpm-workspace.yaml` with `apps/web` and `apps/api` workspaces
- [x] **e1-t2** Scaffold Next.js 15 (App Router, TypeScript strict) in `apps/web` with Tailwind CSS v4 + shadcn/ui init
- [x] **e1-t3** Scaffold FastAPI in `apps/api`: `pyproject.toml` (ruff, mypy, pytest), `main.py` with CORS + `/healthz` endpoint
- [x] **e1-t4** Create `packages/shared-schemas` with initial Zod node/graph schemas + codegen script stub
- [x] **e1-t5** Write `docker/docker-compose.yml`: Postgres 15 + pgvector, Redis 7, FastAPI, Next.js dev server
- [x] **e1-t6** Write Dockerfiles: `docker/Dockerfile.web` (multi-stage) and `docker/Dockerfile.api`
- [x] **e1-t7** Create `supabase/migrations/001_init.sql`: users, graphs, graph_runs, checkpoints, deployments tables + indexes
- [x] **e1-t8** Create `.github/workflows/ci.yml`: parallel jobs — TS (eslint, tsc, vitest) and Python (ruff, mypy, pytest)
- [x] **e1-t9** Write root `README.md` with setup instructions, local dev guide, and env var reference

---

## Epic 2 — Authentication and Core Data Model (Weeks 1–2)

**Goal**: Users can sign up, log in, and have RLS-protected data access.

- [x] **e2-t1** Configure Supabase project: email/password + GitHub OAuth providers, set SITE_URL and redirect URLs
- [x] **e2-t2** Create `apps/web/lib/supabase.ts`: browser + server Supabase clients (`createBrowserClient` / `createServerClient`)
- [x] **e2-t3** Build `apps/web/app/(auth)/login/page.tsx` and `register/page.tsx` using shadcn Form + Supabase Auth UI
- [x] **e2-t4** Create `apps/web/middleware.ts`: session refresh + redirect unauthenticated users to `/login`
- [x] **e2-t5** Implement `apps/api/app/core/auth.py`: JWKS-cached Supabase JWT verification FastAPI dependency
- [x] **e2-t6** Write `supabase/migrations/002_rls.sql`: RLS policies for graphs, checkpoints, deployments (`auth.uid() = user_id`)
- [x] **e2-t7** Create `apps/api/app/routers/users.py`: `GET /users/me` and `PATCH /users/me` profile endpoints
- [x] **e2-t8** Write auth integration tests: pytest (JWT verify, RLS enforcement) + Vitest (login flow, redirect)

---

## Epic 3 — Visual Canvas and Graph CRUD (Weeks 2–3)

**Goal**: Users can drag nodes, connect edges, configure, save, and reload graphs.

- [x] **e3-t1** Create `packages/shared-schemas/src/nodes.ts`: Zod schemas for LLMCaller, RAGRetriever, ConditionalBranch, MCPTool, ApprovalStep node configs
- [x] **e3-t2** Build `apps/web/components/canvas/FlowCanvas.tsx`: React Flow wrapper with custom node/edge types, background, controls, minimap
- [x] **e3-t3** Implement 5 custom node renderers in `apps/web/components/nodes/`: LLMCallerNode, RAGRetrieverNode, ConditionalBranchNode, MCPToolNode, ApprovalStepNode
- [x] **e3-t4** Build `apps/web/components/panels/NodeConfigPanel.tsx`: Zod-form-validated side panel that renders config fields per node type
- [x] **e3-t5** Create `apps/web/components/canvas/NodePalette.tsx`: drag-and-drop node palette with categories (AI, Control, Integration, Human)
- [x] **e3-t6** Create `apps/web/lib/stores/graphStore.ts`: Zustand store for nodes, edges, selection, undo/redo stack
- [x] **e3-t7** Implement `apps/api/app/routers/graphs.py`: POST, GET `/graphs/:id`, PATCH, DELETE with Pydantic validation
- [x] **e3-t8** Implement `apps/api/app/services/dag_validator.py`: NetworkX cycle detection with ≤50ms performance assertion
- [x] **e3-t9** Add 2s debounced auto-save in FlowCanvas + optimistic update via TanStack Query mutation
- [x] **e3-t10** Build `apps/web/app/(dashboard)/page.tsx`: graph list with cards (title, updated_at, node count, deploy status)
- [x] **e3-t11** Write Playwright E2E test: create graph → drag 2 nodes → connect edge → save → reload → assert graph restored

---

## Epic 4 — Execution Engine and Streaming (Weeks 4–6)

**Goal**: Run a graph with LLM nodes and see streaming tokens in the UI.

- [ ] **e4-t1** Implement `apps/api/app/services/execution.py`: graph JSON → LangGraph StateGraph compiler (nodes + edges → state machine)
- [ ] **e4-t2** Implement `apps/api/app/services/llm_caller.py`: LiteLLM wrapper with streaming, model enum (gpt-4o, claude-3-5-sonnet, gemini-2.0-flash)
- [ ] **e4-t3** Implement `apps/api/app/services/rag_retriever.py`: pgvector cosine similarity search (top_k ≤20, min_score ≥0.65) + sentence-transformers embeddings
- [ ] **e4-t4** Implement Conditional Branch node executor: safe expression evaluator (no `eval`, use `simpleeval` or AST-based)
- [ ] **e4-t5** Set up Temporal worker: `apps/api/app/workers/execution_workflow.py` — workflow definition, activity definitions for each node type
- [ ] **e4-t6** Build WebSocket endpoint (`apps/api/app/routers/executions.py`): JWT auth on connect, Redis pub/sub fan-out for token streaming
- [ ] **e4-t7** Implement per-node checkpointing: Supabase insert of state JSONB after each node, AES-256 encrypt, TTL 14 days
- [ ] **e4-t8** Implement retry logic in execution service: exponential backoff 1s/2s/4s, max 3 retries, then log + notify
- [ ] **e4-t9** Create `apps/web/lib/hooks/useExecution.ts`: WebSocket hook with JWT auth, reconnect backoff, state catch-up from last checkpoint
- [ ] **e4-t10** Build `apps/web/components/canvas/ExecutionOverlay.tsx`: per-node status borders (pending/running/success/error) + token counter badge
- [ ] **e4-t11** Build `apps/web/components/panels/ExecutionLogPanel.tsx`: streaming token output, error display, node timing breakdown
- [ ] **e4-t12** Add RAG document ingestion: Supabase Storage upload endpoint + chunking pipeline (chunk size 512 tokens, 50 token overlap)
- [ ] **e4-t13** Write execution tests: mock LLM responses, verify WS message sequence order, assert checkpoint writes ≤100ms

---

## Epic 5 — MCP Integration and Human-in-the-Loop (Weeks 7–8)

**Goal**: Users can search MCP tools, drag them as nodes, and handle approval steps.

- [ ] **e5-t1** Implement `apps/api/app/services/mcp_gateway.py`: registry search with 5-min Redis cache, manifest fetch with 1h cache and ≤5s timeout
- [ ] **e5-t2** Implement `apps/api/app/services/mcp_executor.py`: JSON-RPC 2.0 call execution with OAuth/JWT auth header injection
- [ ] **e5-t3** Build `apps/web/components/panels/MCPSearchPanel.tsx`: registry search UI with debounce, tool cards, drag-to-canvas
- [ ] **e5-t4** Build `apps/web/components/nodes/MCPToolNode.tsx`: dynamic node that renders form fields from MCP tool JSON Schema
- [ ] **e5-t5** Implement `apps/api/app/services/approval.py`: pause Temporal workflow on ApprovalStep, emit form schema via WS, resume on `POST /executions/:id/approve`
- [ ] **e5-t6** Build `apps/web/components/nodes/ApprovalStepNode.tsx`: approval form rendered from JSON Schema, approve/reject buttons, feedback textarea
- [ ] **e5-t7** Write integration test with mock MCP server: GitHub-like tool, create-issue call, assert response mapped to node output

---

## Epic 6 — Deployment Pipeline (Weeks 9–10)

**Goal**: One-click deploy to Cloud, MCP Server, Code Export, Docker.

- [ ] **e6-t1** Implement `apps/api/app/services/deploy_cloud.py`: Vercel API deploy, generate serverless endpoint URL, poll build status ≤20s with circuit breaker at 30s
- [ ] **e6-t2** Implement `apps/api/app/services/deploy_mcp.py`: generate `/mcp` JSON-RPC endpoint + `manifest.json` from graph schema
- [ ] **e6-t3** Implement `apps/api/app/services/deploy_code.py`: generate ZIP with LangGraph Python project (`main.py`, `nodes/`, `requirements.txt`, `.env.example`)
- [ ] **e6-t4** Implement `apps/api/app/services/deploy_docker.py`: generate Dockerfile (Python 3.12-slim base) + `docker-compose.yml` + `.env.example`
- [ ] **e6-t5** Create `apps/api/app/services/deploy.py`: orchestrator that routes to correct deploy service, writes Deployment row, handles rollback on failure
- [ ] **e6-t6** Build `apps/web/components/deploy/DeployModal.tsx`: target picker (Cloud/MCP/Code/Docker), progress bar, live URL copy button, error state
- [ ] **e6-t7** Write round-trip test for Code Export: export graph → execute generated Python script → compare output to canvas execution result

---

## Epic 7 — Marketplace and Billing (Week 11)

**Goal**: Users can publish graphs, browse marketplace, and purchase with Stripe.

- [ ] **e7-t1** Create `supabase/migrations/003_marketplace.sql`: marketplace_listings, purchases tables + tsvector index for full-text search
- [ ] **e7-t2** Implement `apps/api/app/routers/marketplace.py`: CRUD endpoints + `GET /marketplace/search` with tsvector full-text query
- [ ] **e7-t3** Implement `apps/api/app/services/billing.py`: Stripe product + price creation on publish, Stripe Checkout session for purchases
- [ ] **e7-t4** Create `apps/api/app/routers/webhooks.py`: Stripe webhook handler — verify `stripe-signature`, idempotency key check, handle `checkout.session.completed`
- [ ] **e7-t5** Build `apps/web/app/marketplace/page.tsx`: grid of listing cards with search bar, category filter, price filter
- [ ] **e7-t6** Build `apps/web/app/marketplace/[id]/page.tsx`: listing detail with preview, author info, install/purchase button
- [ ] **e7-t7** Build `apps/web/components/marketplace/PublishModal.tsx`: title, description, price config, preview image upload, publish button
- [ ] **e7-t8** Implement "Install to my graphs" flow: clone graph JSON to buyer's account, store `original_author` attribution

---

## Epic 8 — Collaboration, Monitoring, and Production Hardening (Week 12)

**Goal**: Real-time collab works, monitoring is live, security is audited, SLAs are met.

- [ ] **e8-t1** Create `supabase/migrations/004_audit_logs.sql`: audit_logs table + index on `(user_id, created_at DESC)`
- [ ] **e8-t2** Add audit log writes for all mutations: graph CRUD, deploy create, marketplace publish, purchase
- [ ] **e8-t3** Integrate Liveblocks: `apps/web/lib/liveblocks.ts` config + `apps/web/components/canvas/CollaborationCursors.tsx` (presence + cursors)
- [ ] **e8-t4** Implement conflict resolution: Liveblocks storage for node positions (CRDT), Zustand last-write-wins for config fields
- [ ] **e8-t5** Implement `apps/api/app/core/rate_limit.py`: Redis sliding window — 100 req/min per user (API), 10 concurrent executions per user
- [ ] **e8-t6** Set up Sentry: Next.js SDK (`sentry.client.config.ts`, `sentry.server.config.ts`) + FastAPI SDK with source maps
- [ ] **e8-t7** Implement `apps/api/app/core/monitoring.py`: Prometheus metrics — request latency histogram, execution duration, error rate counter, active WS gauge
- [ ] **e8-t8** Add structured JSON logging: pino in Next.js (`apps/web/lib/logger.ts`), structlog in FastAPI (`apps/api/app/core/logging.py`)
- [ ] **e8-t9** Security hardening: add CSP headers in `next.config.ts`, sanitize all user inputs, run OWASP ZAP baseline scan, fix critical findings
- [ ] **e8-t10** Write k6 load test script: 1000 concurrent users, mixed read/write/execute workload, assert p95 latency ≤100ms
- [ ] **e8-t11** Complete Playwright E2E suite to reach 80% coverage: full user journeys (signup → build graph → run → deploy → marketplace publish)
- [ ] **e8-t12** Create `.github/workflows/deploy.yml`: staging deploy on merge to main, prod deploy on release tag

---

## Summary

| Epic | Tasks | Timeline |
|------|-------|----------|
| 1 — Foundation | 9 | Week 1 |
| 2 — Auth & Data Model | 8 | Weeks 1–2 |
| 3 — Canvas & Graph CRUD | 11 | Weeks 2–3 |
| 4 — Execution Engine | 13 | Weeks 4–6 |
| 5 — MCP & Human-in-the-Loop | 7 | Weeks 7–8 |
| 6 — Deployment Pipeline | 7 | Weeks 9–10 |
| 7 — Marketplace & Billing | 8 | Week 11 |
| 8 — Collab & Hardening | 12 | Week 12 |
| **Total** | **75** | **12 weeks** |
