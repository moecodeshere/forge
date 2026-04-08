# Forge AI Workflow Studio

Visual IDE for building and deploying MCP-first agentic AI workflows.
Compose LLM chains, RAG retrievers, and MCP tools on a drag-and-drop canvas — then deploy to Forge Cloud, as an MCP server, or export clean Python code.

---

## Architecture

```
┌───────────────────────────────┐
│ Frontend (Next.js 15)         │
│   • React Flow canvas         │
│   • shadcn/ui + Tailwind v4   │
│   • Liveblocks realtime       │
└───────────────┬───────────────┘
                │ REST / WebSocket
                ▼
┌───────────────────────────────┐
│ Backend (FastAPI + Python)    │
│   • LangGraph execution       │
│   • Temporal long-running     │
│   • MCP gateway + LiteLLM     │
└───────────────┬───────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
┌───────────────┐   ┌───────────────┐
│ Supabase      │   │ Redis 7       │
│ Postgres 15   │   │ pub/sub       │
│ pgvector      │   │ caching       │
└───────────────┘   └───────────────┘
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `npm i -g pnpm` |
| Python | 3.12+ | [python.org](https://python.org) |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker | 25+ | [docker.com](https://docker.com) |
| Docker Compose | v2 | included with Docker Desktop |

---

## Quick Start (Local Dev)

### 1. Clone and install

```bash
git clone https://github.com/your-org/forge.git
cd forge/code
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Edit .env.local and fill in your Supabase credentials
```

Copy the same file for the API:

```bash
cp .env.example apps/api/.env
# Edit apps/api/.env (only the server-side vars are needed here)
```

### 3. Start the data layer

```bash
docker compose -f docker/docker-compose.yml up db redis -d
```

### 4. Run database migrations

```bash
# Using Supabase CLI (recommended)
supabase db push

# Or apply manually against the local DB:
psql postgresql://forge:forge_dev_password@localhost:5432/forge \
  -f supabase/migrations/001_init.sql
```

### 5. Start the backend API

```bash
cd apps/api
uv sync --group dev
uv run uvicorn app.main:app --reload --port 8000
```

API is live at: [http://localhost:8000](http://localhost:8000)
Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 6. Start the frontend

```bash
# From the repo root
pnpm --filter @forge/shared-schemas build
pnpm --filter @forge/web dev
```

Frontend is live at: [http://localhost:3000](http://localhost:3000)

### 7. (Alternative) Start everything with Docker Compose

```bash
docker compose -f docker/docker-compose.yml up
```

---

## Available Scripts

### Root (Turborepo)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | ESLint all packages |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm test` | Run all unit tests |
| `pnpm release:check` | Run API/web release-gate checks |
| `pnpm load:baseline` | Run k6 public endpoint baseline |
| `pnpm signoff:iteration2` | Run final iteration2 close-out automation |

### `apps/web`

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:coverage` | Tests with coverage report |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict check |

### `apps/api`

| Command | Description |
|---------|-------------|
| `uv run uvicorn app.main:app --reload` | Dev server |
| `uv run pytest` | Run all tests with coverage |
| `uv run ruff check .` | Linting |
| `uv run ruff format .` | Formatting |
| `uv run mypy app/` | Type checking |

---

## Project Structure

```
forge/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── app/                # App Router pages
│   │   ├── components/         # UI components
│   │   │   ├── canvas/         # React Flow wrapper
│   │   │   ├── nodes/          # Custom node renderers
│   │   │   ├── panels/         # Config side panels
│   │   │   └── ui/             # shadcn/ui primitives
│   │   ├── lib/                # Utilities, stores, hooks
│   │   ├── hooks/              # Custom React hooks
│   │   └── e2e/                # Playwright tests
│   │
│   └── api/                    # FastAPI backend
│       ├── app/
│       │   ├── main.py         # FastAPI app entry point
│       │   ├── core/           # Config, auth, logging
│       │   ├── routers/        # Route handlers
│       │   ├── services/       # Business logic
│       │   ├── models/         # Pydantic models
│       │   └── workers/        # Temporal workflows
│       └── tests/
│
├── packages/
│   └── shared-schemas/         # Zod schemas (source of truth)
│       ├── src/nodes.ts        # Node type schemas
│       ├── src/graph.ts        # Graph schema
│       └── codegen/            # Pydantic codegen script
│
├── docker/                     # Docker / Docker Compose configs
├── supabase/migrations/        # SQL migration files
└── .github/workflows/          # GitHub Actions CI/CD
```

---

## Environment Variables Reference

| Variable | Where | Required | Description |
|----------|-------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env.local` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env.local` | Yes | Supabase anon public key |
| `NEXT_PUBLIC_API_URL` | `apps/web/.env.local` | Yes | FastAPI base URL |
| `SUPABASE_URL` | `apps/api/.env` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/api/.env` | Yes | Service role key (secret) |
| `SUPABASE_JWT_SECRET` | `apps/api/.env` | Yes | JWT secret for token verification |
| `REDIS_URL` | `apps/api/.env` | Yes | Redis connection string |
| `OPENAI_API_KEY` | `apps/api/.env` | Optional | For LLM Caller node |
| `ANTHROPIC_API_KEY` | `apps/api/.env` | Optional | For Claude models |
| `STRIPE_SECRET_KEY` | `apps/api/.env` | Epic 7 | Stripe billing |
| `LIVEBLOCKS_SECRET_KEY` | `apps/web/.env.local` | Epic 8 | Collaboration |
| `SENTRY_DSN` | Both | Epic 8 | Error tracking |
| `E2E_EMAIL` | shell env | Optional | Playwright login user email |
| `E2E_PASSWORD` | shell env | Optional | Playwright login user password |

See `.env.example` for the full list.

### Release Gate Command

From `code/`:

```bash
pnpm release:check
```

To include login E2E run:

```bash
E2E_EMAIL="your-test-user@example.com" E2E_PASSWORD="your-password" pnpm release:check
```

If E2E credentials are not provided, `release:check` attempts to seed a temporary test user from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `code/.env`.
When available, release scripts use your installed system Chrome for stable Playwright runs.

### Load Baseline Command

From `code/`:

```bash
pnpm load:baseline
```

This runs a lightweight concurrent baseline against `healthz` and `metrics` and writes JSON output to `iteration2/artifacts/load_baseline_public_summary.json`.

### Iteration2 Sign-off Command

From `code/`:

```bash
E2E_EMAIL="your-test-user@example.com" E2E_PASSWORD="your-password" pnpm signoff:iteration2
```

To also mark final bug-triage/sign-off gates:

```bash
E2E_EMAIL="your-test-user@example.com" E2E_PASSWORD="your-password" CONFIRM_NO_P0_P1=true pnpm signoff:iteration2
```

---

## Roadmap

| Epic | Status | Timeline |
|------|--------|----------|
| 1 — Foundation | ✅ In Progress | Week 1 |
| 2 — Auth & Data Model | 🔲 Pending | Week 1–2 |
| 3 — Canvas & CRUD | 🔲 Pending | Week 2–3 |
| 4 — Execution Engine | 🔲 Pending | Week 4–6 |
| 5 — MCP & Human-in-Loop | 🔲 Pending | Week 7–8 |
| 6 — Deployment Pipeline | 🔲 Pending | Week 9–10 |
| 7 — Marketplace & Billing | 🔲 Pending | Week 11 |
| 8 — Collab & Hardening | 🔲 Pending | Week 12 |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with conventional commits: `git commit -m "feat: add X"`
4. Push and open a PR against `develop`
5. CI must pass before merge

---

## License

MIT © Forge AI Workflow Studio
