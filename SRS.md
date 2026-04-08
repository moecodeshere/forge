
# Software Requirements Specification – Forge AI Workflow Studio  
**Version 3 – PDF-Ready Edition**  
**Date:** March 07, 2026  
**Author:** Elite Spec-Driven Development Architect  

**Table of Contents**  
1. Introduction ................................................ 3  
2. Overall Description ....................................... 4  
3. Specific Requirements ..................................... 5  
4. Data Model / Database Schema .............................. 12  
5. Architecture & Technology Decisions ...................... 14  
6. Implementation Notes & Prioritization .................... 16  
7. Appendices .................................................. 20  
8. AI Implementation Guidelines ............................. 22  
9. Detailed Phased Roadmap with Milestones .................. 23  
10. Risk Register & Mitigation Table ........................ 26  
11. Additional Diagrams ...................................... 27  

---

## 1. Introduction

### 1.1 Purpose
Define complete, unambiguous, production-grade requirements for Forge AI Workflow Studio so AI coding agents can implement a secure, scalable platform with ≥ 99.9% uptime and ≤ 0.5% error rate under 1000 concurrent users.

### 1.2 Scope
**In scope:**
- Visual canvas (React Flow) for workflow graphs
- 12 core node types + dynamic MCP nodes
- Stateful execution (LangGraph + Temporal)
- 6 deployment targets (cloud, MCP, API, widget, code, Docker)
- Marketplace with Stripe metered billing
- Real-time collaboration (Liveblocks)

**Out of scope:**
- LLM fine-tuning endpoints
- Native blockchain execution
- AR/VR editing mode

### 1.3 Definitions, Acronyms, Abbreviations

| Term           | Definition                                                                 |
|----------------|----------------------------------------------------------------------------|
| MCP            | Model Context Protocol – JSON-RPC 2.0 over HTTP, manifest fetch ≤ 5s      |
| RAG            | Retrieval-Augmented Generation – cosine similarity ≥ 0.65, max 20 results |
| DAG            | Directed Acyclic Graph – cycle detection ≤ 50ms for 100 nodes             |
| Checkpoint     | JSON state ≤ 1MB, AES-256 encrypted, TTL 14 days                          |
| Node           | React Flow object: id (UUIDv4), type (enum), data (Zod ≤ 4KB)             |

### 1.4 References
- MCP Spec v1.3 (https://modelcontextprotocol.io/spec-v1.3)
- LangGraph v0.2.7 (https://github.com/langchain-ai/langgraph)
- React Flow v12.4 (https://reactflow.dev)
- Supabase v2.1 (https://supabase.com/docs)
- OWASP Top 10 2025

---

## 2. Overall Description

### 2.1 Product Perspective
Forge is the visual IDE for MCP-first agentic AI, combining Figma-like authoring with LangGraph reliability and MCP ecosystem reach.

### 2.2 User Classes

| Class             | Goals                                      | Constraints                     |
|-------------------|--------------------------------------------|---------------------------------|
| Non-technical     | Build/deploy agents in ≤ 5 min             | No code, browser-only           |
| Developer         | Prototype → clean code export              | Needs TS types & fidelity       |
| Enterprise Admin  | Secure internal tools, audit logs          | Self-host + compliance required |

### 2.3 Operating Environment
- Client: Chrome 120+, 6GB RAM min
- Server: Dockerized, Ubuntu 22.04 base, Kubernetes 1.28+ prod
- Network: TLS 1.3, HTTP/2, max 100ms latency

---

## 3. Specific Requirements

### 3.1 Core Node Types (MVP)

| Category     | Node Type           | Inputs                     | Outputs                  | Key Config Fields (Zod)                              |w
|--------------|---------------------|----------------------------|--------------------------|------------------------------------------------------|
| AI           | LLM Caller          | text, context              | text, tool_calls         | model (enum), temp (0–1), max_tokens (≤ 8192)        |
| AI           | RAG Retriever       | query                      | documents[]              | embedding_model, top_k (≤20), min_score (≥0.65)      |
| Control      | Conditional Branch  | value                      | branch_id                | conditions: [{expr: string, target: string}]         |
| Integration  | MCP Tool            | dynamic params             | dynamic result           | mcp_url, tool_name, auth (OAuth/JWT)                 |
| Human        | Approval Step       | request_data               | approved: bool, feedback | form_schema (JSON Schema)                            |

### 3.2 Execution Engine Flow (Text Flowchart)

```
Start
  ↓
Validate DAG (NetworkX cycle check ≤ 50ms)
  ↓ success
Init LangGraph State (checkpoint every node)
  ↓
Loop: Execute Node
  │
  ├─ success ── Checkpoint State ── Stream Token (WS) ──► Human Approval Needed?
  │                                                     ↓ yes
  │                                                     Human-in-Loop (pause + MCP form)
  │                                                     ↓ approved
  │                                                     Continue loop
  │
  └─ error ── Retry (exp backoff: 1s, 2s, 4s, max 3) ──► Fail (log + notify)
  ↓
Final Output (JSON + stream end)
```

### 3.3 Deployment Targets

| Target             | Provisioning Time | Artifact                          | Scaling                     | Persistence |
|--------------------|-------------------|-----------------------------------|-----------------------------|-------------|
| Forge Cloud        | ≤ 20s             | Hosted URL                        | Auto (Vercel/Cloudflare)    | Managed     |
| MCP Server         | ≤ 15s             | /mcp endpoint + manifest          | Edge                        | Managed     |
| Docker Self-Host   | N/A (download)    | Dockerfile + docker-compose.yml   | User-managed                | User        |

---

## 4. Data Model / Database Schema (Text ER Diagram)

```
Users (PK id, email, role)
  │ 1:N
  ▼
Graphs (PK id, user_id FK, title, json_content jsonb, version)
  │ 1:N
  ▼
Deployments (PK id, graph_id FK, type, url, status)
  │
  └─ 1:1 ── last_checkpoint_id ── Checkpoints (PK id, graph_run_id, node_id, state jsonb)
```

Indexes:
- graphs(user_id, updated_at DESC)
- checkpoints(graph_run_id, timestamp DESC)

RLS Policy Example:
```sql
CREATE POLICY "graphs_user_access" ON graphs
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## 5. Architecture Overview (Text Layer Diagram)

```
┌───────────────────────────────┐
│ Frontend (Next.js 16)         │
│   • React Flow canvas         │
│   • shadcn/ui + Tailwind      │
│   • Liveblocks realtime       │
└───────────────┬───────────────┘
                │ API / WS
                ▼
┌───────────────────────────────┐
│ Backend (FastAPI)             │
│   • LangGraph execution       │
│   • Temporal long-running     │
│   • MCP fetch + LiteLLM       │
└───────────────┬───────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
┌───────────────┐   ┌───────────────┐
│ Supabase      │   │ Redis         │
│ Postgres      │   │ pub/sub       │
│ pgvector      │   │ caching       │
└───────────────┘   └───────────────┘
                External
                  ▼
             MCP Registry
```

---

## 9. Detailed Phased Roadmap with Milestones & Dependencies

**Phase 1 – Foundations (Week 1)**
- Prereq: None
- Milestones:
  1. Monorepo + Turborepo init
  2. Supabase project + auth setup (email + GitHub OAuth)
  3. FastAPI /healthz endpoint 200 OK
  4. GitHub Actions CI (lint, typecheck, test)
  5. Docker Compose local stack (backend + db + redis)
- Deliverable: Local `docker compose up` → http://localhost:3000/healthz

**Phase 2 – Core Canvas & Backend (Weeks 2–3)**
- Prereq: Phase 1
- Milestones:
  1. React Flow canvas with drag/drop basic nodes
  2. Graph CRUD APIs (POST/PATCH/GET) with Zod validation
  3. Cycle detection on save (NetworkX)
  4. Playwright E2E: create → save → reload graph
- Deliverable: UI can create/save/load simple graph JSON

**Phase 3 – Execution & Streaming (Weeks 4–6)**
- Prereq: Phase 2
- Milestones:
  1. LLM Caller + RAG nodes implemented
  2. LangGraph conversion + sync execution
  3. WebSocket streaming (JWT auth, reconnect logic)
  4. Checkpoint every node (Supabase insert ≤ 100ms)
  5. Test: LLM call mock → stream tokens → verify WS messages
- Deliverable: Run simple LLM graph → see tokens in UI

**Phase 4 – MCP & Advanced Nodes (Weeks 7–8)**
- Prereq: Phase 3
- Milestones:
  1. MCP registry search API (cache 5min)
  2. Dynamic MCP node creation (schema → form)
  3. Human Approval node with MCP Apps form
  4. Integration test: GitHub MCP → create issue
- Deliverable: Drag MCP tool → execute successfully

**Phase 5 – Deployment & Export (Weeks 9–10)**
- Prereq: Phase 4
- Milestones:
  1. Cloud deploy (Vercel API call from backend)
  2. MCP server manifest generation
  3. Code export ZIP (LangGraph skeleton)
  4. Docker package generation
- Deliverable: Deploy button → live URL in 20s

**Phase 6 – Marketplace & Production (Weeks 11–12)**
- Prereq: Phase 5
- Milestones:
  1. Marketplace publish API + Stripe webhook
  2. Liveblocks collaboration (≤ 20 users)
  3. Sentry error tracking + Prometheus metrics
  4. Full E2E suite (80% coverage)
- Deliverable: Publish graph → usable in Claude Desktop

---

## 10. Risk Register & Mitigation

| Risk ID | Description                              | Probability | Impact | Mitigation Strategy                              |
|---------|------------------------------------------|-------------|--------|--------------------------------------------------|
| R1      | MCP registry downtime/schema change      | Medium      | High   | Cache manifests 1h, fallback mock, retry 3×      |
| R2      | React Flow state desync in collab        | High        | High   | Liveblocks presence + Yjs CRDT fallback          |
| R3      | LangGraph serialization inconsistency   | Medium      | High   | Strict Zod/Pydantic round-trip tests            |
| R4      | Deployment provisioning timeout          | Low         | Medium | Circuit breaker + rollback on >30s               |
| R5      | Stripe webhook replay attacks            | Low         | High   | Idempotency key (UUID) + verify signature        |

---

## 11. Additional Diagrams (Text + ASCII)

### 11.1 User Journey – Create & Deploy Agent (ASCII Flow)

```
Login → Open Canvas → Search MCP "GitHub" → Drag Tool Node
   ↓
Add LLM Node → Connect Edge → Configure Prompt → Save Graph
   ↓
Test Run → See Streaming Tokens → Approve Human Step → Success
   ↓
Click Deploy → Choose "Cloud" → Wait 15s → Get URL
   ↓
Paste URL in Claude → Agent works natively with interactive form
```

### 11.2 Retry Policy Diagram (Text)

```
Error from LLM/MCP
  ↓
Retry 1: delay 1s
  ↓ fail
Retry 2: delay 2s
  ↓ fail
Retry 3: delay 4s
  ↓ fail
Log ERROR + Notify User (toast) + Return fallback message
```

---
