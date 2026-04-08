# Daily Email Summary — Step-by-Step Guide

This guide walks you through building and running the **Daily Email Summary** automation: collect context (RAG), summarize with AI (LLM), and send a daily digest (Gmail). Follow every step in order.

---

## What You’ll Build

- **Trigger** → **RAG Retriever** (fetch context from your documents) → **LLM** (summarize) → **Gmail** (send digest).
- **Inputs:** Run input JSON (e.g. `query` for RAG).
- **Outputs:** Summary text; email sent (or mock when Gmail isn’t configured).

---

## Prerequisites

### 1. Forge running locally

```bash
# Terminal 1 — API
cd code
pnpm install
cd apps/api && source .venv/bin/activate  # or: .\.venv\Scripts\activate on Windows
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Web
cd code
pnpm install
pnpm dev
```

- **API:** http://localhost:8000  
- **Web:** http://localhost:3000  

### 2. Supabase (for RAG)

- Create a project at https://supabase.com.
- In SQL Editor, run the migration that creates the `documents` table and the `match_documents` RPC (see your repo’s Supabase migrations or `docs` for the exact SQL).
- Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `code/apps/api/.env`.

### 3. API keys (for LLM and optional Gmail)

- **OpenAI:** https://platform.openai.com/api-keys → create key.
- **Gmail (optional):** For real send, configure `GMAIL_ACCESS_TOKEN` in the API `.env`. Without it, the Gmail node runs in test mode (mock success).

---

## Step 1: Open the template

1. In the browser, go to **http://localhost:3000**.
2. Sign in (or sign up) if prompted.
3. On the **Dashboard**, scroll to **Start from template**.
4. Click the **Daily Email Summary** card (Operations).
5. You’re now on the canvas with: **Manual Trigger** → **Fetch Context** (RAG) → **Summarize** (LLM) → **Send digest via Gmail**.

---

## Step 2: Configure the RAG node (“Fetch Context”)

1. Click the **Fetch Context** (RAG Retriever) node.
2. In the right **config panel**:
   - **Top K:** `5` (number of chunks to retrieve).
   - **Min score:** `0.65`.
   - **Collection ID:** Leave empty to use the default collection, or set a UUID if you use per-collection RAG.
3. **Input it uses:** The run input JSON. RAG reads `query` from that input; if missing, it uses the whole input as the query string.

**Important:** RAG only returns data if you have documents in Supabase. To ingest documents, use your app’s ingest API or script (e.g. `ingest_document_chunks`) with the same `collection_id` and embedding model.

---

## Step 3: Configure the Summarize node (LLM)

1. Click the **Summarize** (LLM Caller) node.
2. In the config panel:
   - **Model:** e.g. `gpt-4o-mini`.
   - **System prompt:** e.g.  
     `You are a helpful assistant. Summarize the retrieved context into a concise daily digest (bullet points). Output only the digest text, no preamble.`
   - **Temperature:** `0.4`.
   - **Max tokens:** `900`.
3. **Input it uses:** The merged state from the previous node (RAG), e.g. `documents`, `count`, plus the initial run input. The LLM’s “user” message is built from that state, so the model sees the retrieved chunks and can summarize them.
4. **Output:** `output` (the summary text) and `token_count`.

---

## Step 4: Configure the Gmail node (“Send digest via Gmail”)

1. Click the **Send digest via Gmail** (MCP Tool) node.
2. In the config panel, ensure **Connection type** is **Built-in (Gmail, Slack…)**.
3. **Integration Provider:** **Gmail**.
4. **Action:** **Send email**.
5. **To:** Your email (e.g. `yourname@gmail.com`) or `me` if your backend maps that to the authenticated user.
6. **Subject:** e.g. `Daily digest`.
7. **Body:** Leave empty; the summary text comes from the previous node’s `output` (merged into the tool’s payload). When the integration implements real send, it should use that `output` as the email body.
8. **Test mode:** Leave **on** if you don’t have `GMAIL_ACCESS_TOKEN` set (you’ll get a mock success). Turn **off** when you have a real Gmail token and want to send.

---

## Step 5: Save the workflow

1. The graph autosaves; wait for **Saved** in the header.
2. Or press **⌘S** (Mac) / **Ctrl+S** (Windows).
3. If this is a new graph, the first save creates the workflow and assigns it an ID (you may be redirected to `/canvas/<id>`).

---

## Step 6: Set Run input and API keys

1. In the left sidebar, expand **Run settings** (gear icon) if needed.
2. Under **Run input (JSON, passed to manual trigger)**, enter the input for this run, e.g.:

```json
{"query": "What were the main updates and tasks today?"}
```

- Use `query` for RAG so “Fetch Context” has a search query.
3. Under **API keys**, set at least **OpenAI API Key** (for the Summarize node). Optionally set **Anthropic** or **Google** if you switch the model.
4. Keys are used only for this run and are not stored.

---

## Step 7: Run the workflow

1. Click **Execute workflow** (or **⌘↵** / **Ctrl+Enter**).
2. You should see:
   - **Running…** next to the button.
   - In **Execution** / **Log** panel: **Node started** for each node, then **Node completed** (and **Execution completed** at the end).
3. If something fails:
   - **RAG:** Check Supabase env vars and that `documents` + `match_documents` exist; ensure you have ingested some documents.
   - **LLM:** Check API key and model name; check Run settings keys.
   - **Gmail:** With test mode on, it should still “succeed” (mock). With test mode off, ensure `GMAIL_ACCESS_TOKEN` is set in the API `.env`.

---

## Step 8: Check outputs

1. In the execution log, open the **Summarize** node’s result: you should see **output** with the summary text.
2. Open the **Send digest via Gmail** result: with test mode on you’ll see a mock success and the payload (including the summary from the previous step); with real Gmail configured you’d see a real send result.
3. If you use the API directly instead of the UI, the execution response will contain the last node’s output and any error message.

---

## Inputs and outputs summary

| Step            | Input                                                                 | Output                                           |
|-----------------|----------------------------------------------------------------------|--------------------------------------------------|
| Manual Trigger  | Run input JSON (e.g. `{"query": "..."}`)                             | Same object passed to next node                  |
| Fetch Context   | `query` from run input (or full input as string)                      | `documents`, `count`                             |
| Summarize       | Merged state: `documents`, `count`, plus run input                  | `output`, `token_count`                          |
| Send via Gmail  | Merged state: `output` (summary), plus config `to`, `subject`, etc.   | `output` (integration result or mock)            |

---

## Sending email to your Gmail

- **With test mode on:** No real email is sent; the Gmail node returns a mock success. Use this to verify the rest of the flow.
- **With real Gmail:**  
  1. Configure Gmail OAuth (or your backend’s chosen auth) and set `GMAIL_ACCESS_TOKEN` in `code/apps/api/.env`.  
  2. In the Gmail node, turn **Test mode** off.  
  3. Set **To** to your address (or `me` if supported).  
  4. Run again; the integration will send the email using the summary from the previous node as the body (when the connector implements real send).

---

## Quick test (minimal setup)

If you only want to test the pipeline without RAG data:

1. Use the same template and Run input: `{"query": "test"}`.
2. RAG may return no documents; the LLM will still run and summarize whatever context it receives.
3. Keep Gmail in **test mode** so no real email is sent.
4. Confirm all four nodes show **Node completed** and **Execution completed**.

---

## Commands reference

```bash
# Start API (from repo root)
cd code/apps/api && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Start Web
cd code && pnpm dev

# Health check
curl -s http://localhost:8000/healthz
```

---

## Troubleshooting

| Issue              | What to check                                                                 |
|--------------------|-------------------------------------------------------------------------------|
| RAG returns empty  | Supabase env vars; `documents` table and `match_documents` RPC; ingested data |
| LLM error          | Run settings API key; model name; token limits                                |
| Gmail “not configured” | Test mode on = OK (mock). For real send: `GMAIL_ACCESS_TOKEN` in API `.env`. |
| Run doesn’t start  | Graph saved? Run input valid JSON? Logged in?                                 |

Once these steps work, you can switch the trigger to **Schedule** (e.g. daily 9am) so the digest runs automatically.
