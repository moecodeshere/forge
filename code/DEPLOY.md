# Deploy Forge to the web

You need **two** pieces: the **Next.js app** (UI) and the **FastAPI** backend. Supabase stays hosted (your existing project).

## 1. Frontend — Vercel (recommended)

1. Push this repo to **GitHub/GitLab/Bitbucket**.
2. [Vercel](https://vercel.com) → **Add New Project** → import the repo.
3. **Root Directory:** `apps/web` (the folder that contains `vercel.json`).
4. **Environment variables** (Production + Preview):

   | Name | Example |
   |------|---------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key from Supabase **Settings → API** |
   | `NEXT_PUBLIC_API_URL` | `https://your-api.up.railway.app` (after step 2) |
   | `LIVEBLOCKS_SECRET_KEY` | If you use collaboration (`NEXT_PUBLIC_ENABLE_LIVEBLOCKS=true`) |

5. Deploy. Your site will be `https://<project>.vercel.app`.

6. **Supabase → Authentication → URL configuration:** add your Vercel URL to **Site URL** and **Redirect URLs** (e.g. `https://your-app.vercel.app/**`).

## 2. Backend — Docker (Railway, Render, Fly, etc.)

1. Create a service from the repo with **Dockerfile** `docker/Dockerfile.api` and build context = **repository root** (`code/`, the folder that contains `apps/` and `docker/`).
2. Set env vars (at minimum):

   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (or rely on JWKS for ES256)
   - `REDIS_URL` (managed Redis URL)
   - `ENVIRONMENT=production`
   - `CORS_ORIGINS` — JSON array including your **Vercel** origin, e.g.  
     `["https://your-app.vercel.app","http://localhost:3000"]`
   - `API_PUBLIC_URL` — public URL of this API (for MCP / docs)
   - LLM keys as needed (`OPENAI_API_KEY`, …)

3. Point **`NEXT_PUBLIC_API_URL`** in Vercel to this API URL and redeploy the frontend.

## 3. Optional — full stack in Docker

- `docker/Dockerfile.web` builds the Next **standalone** server; pass build args `NEXT_PUBLIC_*` as in the Dockerfile.
- Compose in `docker/docker-compose.yml` is aimed at **local** dev; for production use a host’s orchestration or managed services.

## 4. Checklist

- [ ] API `CORS_ORIGINS` includes the exact browser origin (scheme + host, no trailing slash on origin).
- [ ] Supabase redirect URLs include production login/callback paths.
- [ ] Same Supabase project keys in Vercel and API env.
