# Forge — User-Ready Platform Plan (Next Iteration)

**Goal:** Make the platform user-ready with minimal setup, simplified flows for running agents, using/publishing MCPs, async execution, and code export — and align implementation with the resume vision (one-click deploy with rollback, LangGraph export, MCP server, LiteLLM multi-provider, AES checkpointing). Real-time collaboration is deferred to a later iteration.

**Horizon:** Next iteration (single focused sprint).

---

## 1. User outcomes we’re targeting

| Outcome | What “done” looks like |
|--------|-------------------------|
| **Minimal setup** | New user: sign up → pick template → add API keys and other info in UI only → Run. No .env or CLI. All credentials and config flow correctly through the codebase (execution, ingest, integrations). |
| **Run agents** | Click Run → see streaming output; approval steps pause for human input; RAG works with multi-file and image uploads. |
| **Use MCPs** | **MCP only:** Add “MCP” node → pick server from integrated [Official MCP Registry](https://registry.modelcontextprotocol.io/) (drag-and-drop or search) → configure tool → run. No built-in Gmail/Slack here. |
| **Use Actions** | **Separate section:** “Actions” in the app — Gmail, Google Search, Telegram, Slack, Sheets, Notion, etc. (built-in integrations). Clear distinction: **MCP = registry**; **Actions = in-app integrations**. |
| **Publish workflow as MCP** | Deploy → “Expose as MCP” → get URL + manifest → other agents can call it as a tool. |
| **Async / long runs** | Long workflows don’t block; user can close tab and return to see status; optional Temporal later. |
| **Export code** | One-click “Export as LangGraph” → download runnable Python ZIP with OpenAPI-ready entrypoint. |
| **One-click cloud deploy** | Deploy → choose Cloud → get live URL in ~20s; optional auto-rollback on failure. |
| **Real-time collaboration** | **Deferred** to a later iteration. |

---

## 2. Current state vs target (resume alignment)

| Capability | Current | Target (this iteration) |
|------------|---------|--------------------------|
| Minimal setup / keys | Run settings (localStorage), some env fallback | **All** API keys and config from UI; **audit code flow** so execution, ingest, and integrations use UI-stored keys correctly; server-side encrypted storage. |
| Canvas | React Flow, autosave | **Keep**; surface “Saved” / “Unsaved” clearly. **Real-time collaboration** (Liveblocks) = **later iteration**. |
| Cycle validation | DAG validation on save/run | **Keep**; optionally add “Cycle detected” inline message. |
| One-click cloud deploy | Deploy modal, cloud orchestrator stub | **Implement** Vercel/Cloudflare (or one provider) deploy + **auto-rollback** (revert on health-check failure). |
| LangGraph export | Code export ZIP with LangGraph-style graph | **Add** FastAPI wrapper in export so ZIP is “run and get REST + OpenAPI”; document in README. |
| Deploy as MCP server | MCP manifest + deploy path | **User flow**: Deploy → “Expose as MCP” → public URL + manifest; docs for Claude/Cursor. |
| MCP vs Actions | Single “MCP Tool” node with built-in Gmail/Slack/etc. | **Split:** **MCP** = only from [Official MCP Registry](https://registry.modelcontextprotocol.io/) (drag-and-drop / pick from registry). **Actions** = separate in-app section: Gmail, Google Search, Telegram, Slack, Sheets, Notion, etc. |
| 10+ LLM providers / BYOK | LiteLLM, keys in Run settings (localStorage) | **Keep**; add **server-side encrypted key storage** (AES-256) for “save keys once”; ensure **code flow** uses these everywhere; **per-run cost cap** (optional). |
| RAG | Single-file upload (.txt/.md), retrieval fallbacks | **Multi-file + images:** drag-and-drop **multiple documents and images** into RAG retriever; document and verify **data flow** (ingest → chunk/embed → store → retrieve → LLM). |
| Execution engine | Custom DAG + Redis + checkpoint | **Keep**; **AES-256 checkpoint** and **WebSocket streaming**; **Temporal** = future iteration. |
| Async long-running | Single run in process | **“Run in background”** + execution list with status; optional worker. |

---

## 3. Detailed plan by theme

### 3.1 Minimal setup (all config from UI; zero env for basic run)

- **3.1.1 API keys and info only in UI**  
  Collect all user credentials and config in the UI: API keys (OpenAI, Anthropic, Google, etc.), Gmail OAuth, Action credentials (Slack, Telegram, etc.). No requirement to edit .env or CLI. Optional first-run prompt: “Add your first API key” → save to server-side encrypted store (see 3.5.1).

- **3.1.2 Code flow audit — use UI/stored values everywhere**  
  Ensure the full code flow uses UI-provided or server-stored values correctly:  
  - **Execution:** Run settings / `_secrets` and server-stored keys are merged and passed to every node (LLM, RAG, MCP, Actions).  
  - **Document ingest:** RAG upload uses API key from Run settings or stored keys for embeddings.  
  - **Integrations (Actions):** Gmail, Slack, Telegram, etc. use tokens/keys from Run settings or stored keys, not env only.  
  Audit and fix any path that still relies on env vars when the user has set values in the UI.

- **3.1.3 Run without opening Run settings**  
  If the user has already saved keys (UI or server), execution uses them so “Run” works without opening the panel.

- **3.1.4 Templates that “just run”**  
  At least 2 templates (e.g. “Fetch Public API”, “Simple AI”) work with minimal or no keys; label them “No setup” on dashboard.

**Deliverables:** All credentials/config from UI; code flow audit complete; execution and ingest use UI/stored keys; “No setup” templates marked.

---

### 3.2 Running agents (stability + UX)

- **3.2.1 RAG: multi-document and image drag-and-drop**  
  - **UI:** RAG Retriever node supports **drag-and-drop of multiple files**: documents (.txt, .md, .pdf if supported) and **images**. User can drop several at once; show list of queued/ingested files.  
  - **Backend:** Ingest pipeline accepts multiple files; for **documents**: chunk and embed as today; for **images**: either (a) extract text via vision/OCR and treat as text chunks, or (b) use vision embeddings if available — decide and implement one path.  
  - **Data flow (document and verify):**  
    1. **Ingest:** Files → chunk (documents) / process (images) → embed → store in `documents` (pgvector).  
    2. **Retrieval:** Query (from run input or default) → embed → similarity search → ranked `documents[]`.  
    3. **Result:** RAG node output `{ documents, count }` → merged into state → **LLM node** receives “Retrieved context to summarize” (or variable) and produces final answer.  
  - Add **ingest status** in Run or node (“3 docs, 2 images loaded” / “Upload docs in RAG node”) so user knows why 0 docs.  
  - Ensure execution path is tested: upload → run → retrieval → LLM receives content → output.

- **3.2.2 Approval node UX**  
  When execution hits approval node: **clear “Waiting for approval”** in Execution log; **approve/reject** in UI with optional feedback; resume run and stream result.

- **3.2.3 Execution list + status**  
  **Executions** tab: list last N runs (run_id, graph name, status, started_at, duration); click → expand or open run detail; **“Run in background”** starts run and shows “Running…” with link to this list.

- **3.2.4 Per-run cost cap (optional)**  
  Run settings: optional “Max cost this run ($)” (e.g. 0.50); execution checks after each LLM call (if cost tracking available); stop run and notify if exceeded.

**Deliverables:** RAG ingest hint; approval flow visible and usable; executions list with status; optional cost cap.

---

### 3.3 MCP vs Actions — clear distinction

**Principle:** **MCP** = tools from the [Official MCP Registry](https://registry.modelcontextprotocol.io/) only. **Actions** = built-in app integrations (Gmail, Slack, Telegram, Google Search, Sheets, Notion, etc.) in a separate section.

- **3.3.1 MCP section (registry only)**  
  - **Node:** “MCP” or “MCP Tool” node — **only** for servers from the integrated **Official MCP Registry**.  
  - **UI:** Integrate with registry API (e.g. production: `registry.modelcontextprotocol.io`); user can **search/browse** and **drag-and-drop** (or pick) an MCP server from the registry into the canvas.  
  - **Config:** Once a server is chosen (by registry id or URL from registry), show **tool picker** (list tools from that server’s manifest); user selects tool and configures params. No custom “paste any URL” in this node — only registry-sourced MCPs.  
  - **Credentials:** If an MCP server requires auth, collect via Run settings or node config (no .env).

- **3.3.2 Actions section (in-app integrations)**  
  - **Node:** “Action” node (or separate “Actions” category in palette) for **built-in integrations**: Gmail, Google Search, Telegram, Slack, Google Sheets, Notion, etc.  
  - **UI:** User picks an action (e.g. “Gmail – Send email”, “Slack – Post message”, “Telegram – Send message”). Config form per action (to, subject, body, channel, etc.).  
  - **Credentials:** All from Run settings (or server-side stored keys); no .env. “Test mode” vs “Send real” where applicable (e.g. Gmail “Send real email” checkbox).  
  - **Backend:** Existing integration service (Gmail, Slack, etc.) is used by the **Action** node only; MCP node does **not** call these — it only calls registry MCP servers.

- **3.3.3 Palette / canvas structure**  
  - In node palette (or sidebar): **two clear sections** — **“MCP”** (from registry) and **“Actions”** (Gmail, Slack, Telegram, Google Search, Sheets, Notion, …).  
  - No mixing: preset “MCP” tools are not used for Gmail/Slack; those live under Actions.

**Deliverables:** MCP node = registry only (integrated registry API, drag-and-drop or pick); Action node = in-app integrations only; clear separation in UI and code.

---

### 3.4 Publishing workflow as MCP + one-click deploy

- **3.4.1 “Expose as MCP”**  
  In Deploy modal: checkbox or option “Expose as MCP server”. On deploy (cloud or Forge-hosted):  
  - Generate MCP manifest (name, tools from graph inputs/outputs).  
  - Serve at `https://<deploy-url>/mcp` (or documented path).  
  - Show user: “MCP URL” + “Add to Claude/Cursor: …”.

- **3.4.2 One-click cloud deploy**  
  - Integrate one provider (e.g. Vercel): create project, deploy API route that runs graph (or proxy to Forge API).  
  - Post-deploy: hit health check; if fail after N retries → **auto-rollback** (revert to previous deployment or show “Deployment failed” and keep previous).  
  - Show live URL and “OpenAPI docs” link if we generate OpenAPI for the deployed route.

- **3.4.3 Deploy artifact**  
  Ensure deploy produces:  
  - **REST endpoint** (e.g. POST /run with graph_id or inline graph).  
  - **OpenAPI** (auto-generated from FastAPI or static spec).  
  - **MCP endpoint** (when “Expose as MCP” is on).

**Deliverables:** “Expose as MCP” option; one cloud provider deploy with health check + auto-rollback; OpenAPI for deployed API.

---

### 3.5 Async execution + key storage

- **3.5.1 Server-side encrypted API keys**  
  - New table or Supabase vault: `user_api_keys` (user_id, key_name, encrypted_value, created_at).  
  - Encrypt with AES-256 (reuse checkpoint key derivation or dedicated key from env).  
  - Run settings: “Save keys to account” → store encrypted; execution and ingest read from DB when Run settings panel has empty keys (or always merge).  
  - Scope: OpenAI, Anthropic, Google, Gmail (same as current Run settings).

- **3.5.2 Run in background**  
  - “Run” button: optional “Run in background” (or always background for long graphs).  
  - Start execution → return run_id immediately; frontend subscribes to WS for run_id and shows “Running…” then “Completed”/“Failed”.  
  - Executions tab shows running and completed; user can close canvas and come back to see status.

- **3.5.3 Temporal (out of scope this iteration)**  
  Document as “Phase 2”: Temporal workers for durable long-running workflows; this iteration = background run + Redis + checkpoint only.

**Deliverables:** Encrypted key storage; “Run in background” + executions list; no Temporal yet.

---

### 3.6 Export code (LangGraph + runnable REST)

- **3.6.1 Export ZIP contents**  
  - Keep current LangGraph-style main + nodes.  
  - Add **FastAPI app** in export: single POST /run (body = input JSON); invokes graph; returns result; **OpenAPI** at /docs.  
  - README in ZIP: “pip install -r requirements.txt”, “uvicorn app.main:app”, “POST /run”, “See /docs”.

- **3.6.2 One-click export**  
  Dashboard or canvas: “Export as code” → download ZIP (name = graph slug). No extra steps.

**Deliverables:** Export ZIP includes runnable LangGraph + FastAPI + OpenAPI; one-click download; README with run instructions.

---

### 3.7 Real-time collaboration — **later iteration**

- **Out of scope this iteration.**  
  Real-time collaboration (Liveblocks: presence, room sync, “Saved”/“Unsaved” with multi-user) will be implemented in a **later iteration**.  
  This iteration: keep single-user canvas with autosave and clear “Saved”/“Unsaved” when server confirms (no Liveblocks required).

---

### 3.8 Polish and docs

- **3.8.1 Canvas onboarding**  
  First-time empty canvas: short tooltip tour (add node, connect, Run, Save) or “Add your first node” CTA. Dismissible.

- **3.8.2 Help / docs**  
  - “How to run an agent” (template → Run → see output).  
  - “How to add MCP” (MCP node — pick/drag from Official MCP Registry only).  
  - “How to add Actions” (Actions node — Gmail, Slack, Telegram, Google Search, etc.).  
  - “How to deploy as MCP” (Deploy → Expose as MCP → copy URL).  
  - “How to export code” (Export → run locally).

- **3.8.3 Cycle validation message**  
  On save or run, if cycle detected: inline message “Cycle detected between nodes X and Y” with node labels if possible.

**Deliverables:** Optional onboarding; 4 help docs; cycle error message.

---

## 4. Implementation order (suggested)

| Phase | Theme | Tasks | Priority |
|-------|--------|--------|----------|
| **A** | Minimal setup + code flow | 3.1.1–3.1.2 API keys from UI only; **code flow audit** so execution/ingest/Actions use UI/stored keys | P0 |
| **B** | Key storage | 3.5.1 Encrypted API key storage (Supabase table + AES-256) | P0 |
| **C** | RAG multi-file + images | 3.2.1 Drag-and-drop multiple docs + images; document/verify data flow; ingest status | P0 |
| **D** | MCP vs Actions | 3.3.1 MCP = registry only (integrate registry API); 3.3.2 Actions = separate node/section (Gmail, Slack, Telegram, etc.) | P0 |
| **E** | Run UX | 3.2.2 Approval UX, 3.2.3 Executions list + “Run in background” | P0 |
| **F** | Deploy + publish as MCP | 3.4.1 Expose as MCP, 3.4.2 One-click cloud + rollback, 3.4.3 OpenAPI | P0 |
| **G** | Export | 3.6.1 FastAPI + OpenAPI in ZIP, 3.6.2 One-click export | P0 |
| **H** | Polish | 3.8.1 Onboarding, 3.8.2 Docs (incl. “MCP from registry” vs “Actions”), 3.8.3 Cycle message; 3.2.1 RAG ingest hint; 3.2.4 Cost cap (optional) | P1 |
| — | **Later** | 3.7 Real-time collaboration (Liveblocks) | Next iteration |

---

## 5. Resume-bullet alignment checklist

After this iteration, you should be able to truthfully say:

- **Canvas:** Visual drag-and-drop AI workflow canvas (React Flow) for authoring, executing, and deploying multi-agent pipelines as DAGs; autosave; **cycle validation**; **one-click cloud deployment with auto-rollback**. (Real-time collaboration = roadmap.)

- **Agent lifecycle:** Design workflow on canvas → **export as runnable LangGraph Python code** (ZIP with FastAPI + OpenAPI) → **deploy as live REST endpoint** with auto-generated OpenAPI docs → **expose as MCP server** so other agents can call it as a tool.

- **LLM + RAG + tools:** **10+ LLM providers** via LiteLLM; **bring-your-own-key** with **server-side AES-256 encrypted storage**; prompt chaining; streaming; optional **per-run cost cap**; **RAG** with **multi-document and image** drag-and-drop and verified retrieval→LLM flow; **MCP** from Official MCP Registry; **Actions** (Gmail, Slack, Telegram, Google Search, etc.) as separate in-app integrations; **human-in-the-loop approval** nodes.

- **Execution:** FastAPI execution engine; **AES-256 encrypted checkpointing** (already in place); **WebSocket token streaming**; Redis for real-time state; **background run** for long workflows. (Temporal workers = “designed for” or “roadmap” if not implemented.)

---

## 6. Out of scope this iteration

- **Temporal** workers (defer to next iteration).  
- **Real-time collaboration** (Liveblocks presence/sync) — later iteration.  
- **Stripe** metered billing and full marketplace payment flow.  
- **NetworkX** explicitly in cycle check (current DAG validation is sufficient).  
- **Full LangGraph** execution in backend (keep custom executor; export remains LangGraph).  
- **xAI** and every LiteLLM provider (keep current set; “10+” is already true via LiteLLM).

---

## 7. Files and areas to touch

| Area | Files / dirs |
|------|----------------|
| Code flow (keys) | Audit: `execution.py`, `rag_retriever.py`, ingest router, `mcp_tool.py`, integration connectors; ensure UI/stored keys used everywhere |
| Encrypted keys | New: `app/services/user_keys.py`, migration for `user_api_keys`; `app/routers/users.py` or `settings.py`; `app/services/execution.py` (read keys) |
| RAG multi-file + images | Frontend: RAG node config (drag-and-drop multi-file + images); backend: ingest (chunk/embed images); verify retrieval → LLM path |
| MCP (registry only) | Frontend: MCP node wired to [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/) API; pick/drag from registry only |
| Actions (in-app) | New “Action” node type; palette section “Actions”; Gmail, Slack, Telegram, Google Search, Sheets, Notion; reuse `IntegrationService` |
| Run in background | `app/routers/executions.py` (return run_id immediately); `app/workers/` (optional worker); frontend Executions tab + WS |
| Deploy + publish as MCP | `app/services/deploy/` (cloud, MCP manifest); frontend `DeployModal`; health check + rollback logic |
| Export | `app/services/deploy/code_export.py` (add FastAPI app + README) |
| Approval UX | `ExecutionLogPanel`, approval step component, API approve endpoint |
| Executions list | New or existing Executions tab; API `GET /graphs/{id}/runs` or reuse runs list |
| Docs / onboarding | `app/help/` or `/docs`; tooltip tour in `FlowCanvas`; docs for “MCP from registry” vs “Actions” |

---

*End of plan. Use this as the single source of truth for the next iteration; adjust priorities if the sprint is shorter.*
