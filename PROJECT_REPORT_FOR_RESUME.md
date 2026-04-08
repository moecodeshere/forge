# Forge AI Workflow Studio — Project Report (Resume / LLM Input)

**Purpose:** Use this document as input for an LLM or recruiter to draft resume bullets and project descriptions. It reflects the **full product vision** from the SRS, what is **implemented**, and what is **planned or underused**.

---

## 1. Product Vision (from SRS)

**Forge** is a **visual IDE for MCP-first agentic AI**: a Figma-like workflow authoring platform that combines:

- **Visual canvas** (React Flow) for building workflow graphs
- **Stateful execution** with checkpointing and streaming
- **MCP (Model Context Protocol)** integration for tools and agents
- **Multiple deployment targets** (cloud, MCP server, Docker, code export)
- **Marketplace** with monetization
- **Real-time collaboration** (Liveblocks)

**Target users:** Non-technical (build/deploy in ≤5 min), Developers (prototype → code export), Enterprise (self-host, audit, compliance).

**Scope (in SRS):** 12+ core node types, dynamic MCP nodes, 6 deployment targets, Stripe metered billing, Liveblocks collaboration, ≥99.9% uptime goal, ≤0.5% error rate under 1000 concurrent users.

**Out of scope (SRS):** LLM fine-tuning endpoints, native blockchain execution, AR/VR editing.

---

## 2. Architecture (as specified and as built)

| Layer | SRS / Spec | Current state |
|-------|------------|----------------|
| **Frontend** | Next.js 16, React Flow canvas, shadcn/ui + Tailwind, Liveblocks | Next.js, React Flow, shadcn/Tailwind; Liveblocks present but **not heavily used** for multi-user editing |
| **Backend** | FastAPI, LangGraph execution, Temporal long-running, MCP + LiteLLM | FastAPI; **custom DAG executor** (not LangGraph); **no Temporal**; MCP + LiteLLM in use |
| **Data** | Supabase Postgres, pgvector (RAG), Redis pub/sub | Supabase (auth, graphs, documents, checkpoints); Redis for execution pub/sub |
| **Execution** | DAG validation (e.g. NetworkX ≤50ms), checkpoint every node, WebSocket streaming, retry (1s, 2s, 4s, max 3) | DAG validation, per-node checkpoint, WebSocket streaming, retry with backoff implemented |

---

## 3. Implemented Features (what exists today)

### 3.1 Core canvas and workflows
- **Visual workflow editor:** React Flow canvas; drag-and-drop nodes; edges; zoom/pan; minimap
- **Graph CRUD:** Create, read, update, delete graphs; **autosave**; **rename** (inline); **Save** button; **Delete workflow** (canvas menu + dashboard)
- **Dashboard:** List workflows; template picker; **Delete** and **Edit** per workflow; relative timestamps
- **Templates:** Pre-built workflows (e.g. Fetch API, Transform Data, Simple AI, Daily Email Summary, Slack Alert Triage, RAG Chat); start from template or blank

### 3.2 Node types (implemented in backend + frontend)
- **Triggers:** Manual, Webhook, Schedule, Form submission, App event
- **AI:** LLM Caller (streaming), Simple LLM, **RAG Retriever** (pgvector, Supabase), AI Agent
- **Integration:** **MCP Tool** (built-in Gmail, Slack, Sheets, Notion + custom MCP server URL)
- **Control:** Conditional branch, Approval step
- **Data/flow:** Set node, HTTP Request, **Delay**, **JSON Parse**, **JSON Stringify**, **Merge**, **Filter**

### 3.3 Execution and ops
- **Execution engine:** Topological run over DAG; per-node plugins; **checkpoint after each node**; WebSocket streaming (tokens, node started/completed/failed)
- **Run settings:** JSON run input; **API keys in UI** (OpenAI, Anthropic, Google, **Gmail OAuth token**); persisted in localStorage; passed as secrets to execution
- **Integrations:** Gmail (real send via OAuth token from Run settings); Slack/Sheets/Notion stubs or v1; **test mode** vs live for integrations
- **RAG:** Document upload (.txt/.md) in RAG node config; chunking + embedding (OpenAI); storage in Supabase `documents` (pgvector); retrieval via `match_documents` / `match_documents_with_collection`; **default query and fallback threshold** for “no documents”; LLM receives retrieved content as clear text for summarization

### 3.4 Deployment and marketplace (scaffolded / partial)
- **Deploy:** Deploy modal; **MCP server** manifest generation; **code export** (LangGraph-style skeleton); **Docker** export; **cloud** deploy (orchestrator present; full provisioning may be incomplete)
- **Marketplace:** Listings, publish, install (clone to user graphs); **Stripe/billing** referenced but **not fully wired** (metered billing, webhooks)
- **Webhooks:** Endpoint for workflow trigger by external POST

### 3.5 Auth, API, and infra
- **Auth:** Supabase Auth (email + OAuth); protected routes; session in API
- **API:** FastAPI; health check; graphs, executions, documents ingest, integrations, MCP, marketplace, deployments, users, setup
- **Observability / hardening:** Monitoring and rate-limit modules exist; **load baseline (e.g. k6)** referenced; **Sentry** mentioned in SRS but usage not fully evident

---

## 4. From SRS — Not Implemented or Underused

### 4.1 Execution and orchestration
- **LangGraph:** SRS specifies LangGraph conversion and execution; **current implementation uses a custom DAG executor**, not LangGraph.
- **Temporal:** SRS specifies Temporal for long-running workflows; **not implemented**; long runs are handled by the custom executor + Redis.
- **NetworkX:** SRS mentions cycle check (e.g. ≤50ms); cycle detection is implemented but **not necessarily NetworkX**; DAG validation is in place.

### 4.2 Collaboration
- **Liveblocks:** Present in codebase (e.g. CollaborationCursors, liveblocks config); **real-time multi-user editing is not a primary flow**; cursors/presence may be minimal or experimental.

### 4.3 Marketplace and billing
- **Stripe metered billing:** SRS calls for marketplace with Stripe; **billing/webhook integration is scaffolded or partial**; not production-ready.
- **Marketplace E2E:** Publish and install flows exist; **full “publish → buy → install” and payment flow** not fully implemented or used.

### 4.4 Deployment targets
- **Forge Cloud (≤20s provisioning):** Cloud deploy path exists; **automated provisioning (e.g. Vercel/Cloudflare) in ≤20s** not fully verified.
- **MCP Server (≤15s):** MCP manifest and deploy exist; **timing and production hardening** not fully specified.
- **Docker self-host:** Export and Dockerfile/docker-compose exist; **user-facing “download and run” flow** may be minimal.

### 4.5 Node and config UX (from implementation plan)
- **Set node:** Full key-value UI (add/remove rows, no JSON-only) — **partially done**; advanced/JSON still used.
- **Conditional branch:** **Node picker** (dropdown of target nodes) — **not fully done**; may still use raw target IDs.
- **LLM nodes:** **Prompt templates with variable chips** (e.g. `{{input.query}}`, `{{node_id.output}}`) — **limited**; prompts are text.
- **HTTP Request:** Key-value headers, JSON/form body, **“Test request”** — **not fully built**.
- **Schedule trigger:** Presets (“Every hour”, “Daily 9am”) — **partially present**; cron/interval mapping may be partial.
- **MCP tool:** **Tool picker** (fetch tools from server URL) — **simplified**; custom URL + tool name; not full discovery UX.
- **Canvas onboarding:** **First-time tooltip tour** — **not implemented**.
- **Node palette:** **Search/filter and categories** — **partial**; palette exists but discoverability improvements planned.

### 4.6 Production and compliance (SRS)
- **Targets:** ≥99.9% uptime, ≤0.5% error rate under 1000 concurrent users — **not validated** in production.
- **Checkpoint:** JSON state ≤1MB, AES-256 encrypted, TTL 14 days — **encryption/TTL** may be partial or not fully enforced.
- **Audit logs:** Enterprise requirement; **audit service exists** but **enterprise audit/compliance** not fully built out.
- **OWASP / security:** Referenced in SRS; **no explicit checklist** in this report.

---

## 5. Technical stack (for resume)

- **Frontend:** Next.js, React, React Flow, TypeScript, Tailwind CSS, shadcn/ui, Liveblocks (collab), Supabase client
- **Backend:** FastAPI (Python), Supabase (Postgres, Auth, pgvector), Redis (pub/sub), LiteLLM (LLM + embeddings)
- **Integrations:** Gmail API (OAuth), Slack/Sheets/Notion (integration layer), MCP (JSON-RPC 2.0 over HTTP)
- **RAG:** pgvector, OpenAI embeddings, chunked document ingest, similarity search (cosine), configurable threshold and fallback
- **Deploy/export:** MCP server manifest, code export (LangGraph-style), Docker, cloud orchestrator
- **DevOps / quality:** pytest, Playwright (E2E referenced), CI, migrations (Supabase)

---

## 6. Suggested resume bullets (raw material for LLM)

You can hand the following to an LLM and ask it to tighten into 3–5 resume bullets and a 2–3 line project summary, without overclaiming:

- Built a **visual AI workflow studio** (Forge) with a **React Flow** canvas for designing DAG-based agent workflows; **custom execution engine** with per-node checkpointing, WebSocket streaming, and retry with backoff.
- Implemented **RAG pipeline**: document upload and chunking, **OpenAI embeddings**, **pgvector** (Supabase) storage and similarity search, retrieval fallbacks and default query so summarization workflows return documents; **LLM caller** consumes retrieved context as plain text.
- Integrated **MCP (Model Context Protocol)** and **built-in integrations** (Gmail, Slack, Google Sheets, Notion); **credentials via UI** (Run settings) including Gmail OAuth token; test vs live mode for safe development.
- Delivered **multi-node catalog**: triggers (manual, webhook, schedule, form, app event), LLM/RAG/agent nodes, conditional branch, approval step, HTTP request, Set, Delay, JSON Parse/Stringify, Merge, Filter, MCP tool.
- Added **deployment and marketplace scaffolding**: MCP server manifest generation, **code export** (LangGraph-style), Docker export, cloud deploy orchestration; **marketplace** list/publish/install; **Stripe/billing** and **Liveblocks** present but not fully productionized.
- Implemented **graph lifecycle**: CRUD, autosave, rename, delete workflow, dashboard with templates; **document ingest API** and **Run settings** (API keys + Gmail token) for zero-env-edit setup.
- Designed to **SRS spec**: DAG validation, checkpointing, streaming, retry policy; **LangGraph and Temporal** specified in SRS but **replaced with custom executor** for current implementation; **observability and rate limiting** modules in place; **E2E and load baseline** referenced in iteration plan.

---

## 7. One-line and two-line summaries (for resume)

**One-line:**  
Visual AI workflow platform (React Flow + FastAPI) with RAG, MCP integrations (Gmail, Slack, etc.), custom DAG execution with checkpointing and streaming, document ingest/retrieval (pgvector), and deployment/marketplace scaffolding.

**Two-line:**  
Forge is an MCP-first visual workflow IDE: drag-and-drop canvas, 15+ node types (triggers, LLM, RAG, MCP tools, control flow, data ops), Supabase + pgvector RAG, Run settings for API keys and Gmail OAuth, and deploy/marketplace scaffolding. Implemented custom DAG executor with checkpoints and WebSocket streaming; SRS also specifies LangGraph and Temporal for future hardening.

---

*End of report. Use with an LLM to generate final resume text; adjust tense and emphasis (e.g. “Designed”, “Implemented”, “Scaffolded”) to match your role and what you want to highlight.*
