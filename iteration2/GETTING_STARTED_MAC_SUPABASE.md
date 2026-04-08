# Get Daily Email Summary Up and Running (Mac + Supabase)

Use this checklist so we have everything needed to run the **Daily Email Summary** flow on your Mac with Supabase.

**Simplified flow:** Most setup is now done in the app with a few clicks (Settings → RAG Setup, and document upload from the RAG node config).

---

## What I need from you

### 1. Supabase project

- You already use Supabase, so you should have:
  - **Project URL** — e.g. `https://xxxxx.supabase.co`
  - **Service role key** — Supabase Dashboard → **Project settings** → **API** → **Project API keys** → `service_role` (secret)

Keep these for step 3.

---

### 2. Run the RAG migration in Supabase

The app expects a `documents` table and two RPCs: `match_documents` and `match_documents_with_collection`.

**Option A — One-click (from the app)** — Sign in, go to **Settings** → **RAG Setup**, paste Database URL, click **Initialize RAG**.

**Option A-alt — Supabase CLI (Mac)**

```bash
cd /Users/mohitsharma/Desktop/forge/code
# If you haven’t linked the project:
# npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

(If you don’t use `supabase link`, use Option B.)

**Option B — Supabase Dashboard**

1. Open your project at https://supabase.com/dashboard.
2. Go to **SQL Editor**.
3. Copy the full contents of **`code/supabase/migrations/003_documents.sql`**.
4. Paste into the editor and **Run**.

That creates the `documents` table (with `pgvector`) and the two match functions.

---

### 3. Environment variables

**API** — create or edit `code/apps/api/.env`:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Required for the LLM (Summarize) node
OPENAI_API_KEY=sk-...

# Optional: only if you want real Gmail send (otherwise Gmail node runs in test/mock mode)
# GMAIL_ACCESS_TOKEN=...
```

**Web** — create or edit `code/apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Get the anon key from the same **API** settings page in the Supabase dashboard.

---

### 4. Start the app on your Mac

**Terminal 1 — API**

```bash
cd /Users/mohitsharma/Desktop/forge/code
pnpm install
cd apps/api && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Web**

```bash
cd /Users/mohitsharma/Desktop/forge/code
pnpm dev
```

- API: http://localhost:8000  
- Web: http://localhost:3000  

---

### 5. Sign in and open the template

1. Open **http://localhost:3000** in the browser.
2. Sign in (or sign up) with Supabase Auth.
3. Dashboard → **Start from template** → **Daily Email Summary**.

---

### 6. (Required for RAG) Add documents

RAG returns nothing until there are rows in `documents`. **In-app:** Select the RAG Retriever node and click **Upload .txt or .md file**. **Or use curl** (below); use the same collection ID you’ll use in the RAG node (or leave collection empty and use the default).

**Get your JWT**

- After signing in, the app stores the session; you need a JWT for the API. Easiest: use the browser’s Network tab when using the app, or use the Supabase “Get token” from the dashboard (Auth → Users → select user → copy token), or log in via the web app and copy the token from devtools (Application → Local Storage, or the session cookie).

**Ingest a file (e.g. a `.txt` file)**

```bash
# Replace GRAPH_ID with the graph id of your Daily Email Summary workflow (from the URL or after saving).
# Replace COLLECTION_ID with a UUID you’ll use in the RAG node config, e.g. 00000000-0000-0000-0000-000000000001
# Replace YOUR_JWT with the Supabase JWT (Bearer token).

curl -X POST "http://localhost:8000/executions/GRAPH_ID/documents?collection_id=COLLECTION_ID" \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@/path/to/your/notes.txt"
```

If you leave **Collection ID** empty in the RAG node, the retriever may use a default; check the RAG node code/docs for that default. If it expects a specific UUID, set **Collection ID** in the RAG config to the same `COLLECTION_ID` you used in the curl above.

**Alternative:** Use the same `collection_id` in the template’s RAG node and in the ingest request so they match.

---

### 7. Run the workflow

1. In the Daily Email Summary canvas, set **Run input** to e.g. `{"query": "What did we decide about the project?"}`.
2. Click **Run**.
3. Check **Run** feedback (Running → Completed/Failed) and the outputs on the **Summarize** and **Send digest** nodes.

---

## Quick reference

| What | Where |
|------|--------|
| Supabase URL & keys | Dashboard → Project settings → API |
| RAG migration SQL | `code/supabase/migrations/003_documents.sql` |
| API env | `code/apps/api/.env` |
| Web env | `code/apps/web/.env.local` |
| Ingest endpoint | `POST /executions/{graph_id}/documents?collection_id=...` |
| Full step-by-step UI guide | [DAILY_EMAIL_SUMMARY_GUIDE.md](./DAILY_EMAIL_SUMMARY_GUIDE.md) |

---

## If something doesn’t work

- **RAG returns empty** — Supabase env vars set in API `.env`? Migration run? Documents ingested for the same `collection_id`?
- **LLM error** — `OPENAI_API_KEY` in API `.env`; in Run settings, API key override if the app uses it.
- **Gmail “not configured”** — With test mode on, the node still completes (mock). For real send, set `GMAIL_ACCESS_TOKEN` in API `.env`.
- **Run doesn’t start** — Save the graph first; use valid JSON in Run input; make sure you’re signed in.

Once you’ve done steps 1–5 and 6 (ingest), you have everything needed to run the Daily Email Summary on your Mac with Supabase.
