"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Database, Key, ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initRagDatabase } from "@/lib/api/setup";

const API_KEYS_STORAGE = "forge-api-keys";

// Migration SQL path - we fetch it from the public file or embed a minimal copy
const RAG_MIGRATION_SQL = `-- Run in Supabase SQL Editor. From: code/supabase/migrations/003_documents.sql
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents (user_id);
CREATE INDEX IF NOT EXISTS documents_collection_idx ON documents (collection_id);
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own documents" ON documents;
CREATE POLICY "Users manage own documents" ON documents FOR ALL USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION match_documents(query_embedding extensions.vector(1536), match_count int DEFAULT 5, match_threshold float DEFAULT 0.65)
RETURNS TABLE (id uuid, content text, metadata jsonb, similarity float) LANGUAGE sql STABLE SET search_path = extensions, public AS $$
  SELECT d.id, d.content, d.metadata, 1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.documents d WHERE 1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  ORDER BY d.embedding OPERATOR(extensions.<=>) query_embedding LIMIT match_count;
$$;
CREATE OR REPLACE FUNCTION match_documents_with_collection(query_embedding extensions.vector(1536), p_collection_id uuid, match_count int DEFAULT 5, match_threshold float DEFAULT 0.65)
RETURNS TABLE (id uuid, content text, metadata jsonb, similarity float) LANGUAGE sql STABLE SET search_path = extensions, public AS $$
  SELECT d.id, d.content, d.metadata, 1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.documents d WHERE d.collection_id = p_collection_id
  AND 1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  ORDER BY d.embedding OPERATOR(extensions.<=>) query_embedding LIMIT match_count;
$$;`;

export default function SettingsPage() {
  const [keys, setKeys] = useState<Record<string, string>>({
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GOOGLE_API_KEY: "",
  });
  const [saved, setSaved] = useState(false);
  const [dbUrl, setDbUrl] = useState("");
  const [ragInitStatus, setRagInitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [ragError, setRagError] = useState("");
  const [sqlCopied, setSqlCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(API_KEYS_STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        setKeys((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function handleInitRag() {
    if (!dbUrl.trim()) return;
    setRagInitStatus("loading");
    setRagError("");
    try {
      await initRagDatabase(dbUrl.trim());
      setRagInitStatus("success");
      setDbUrl("");
    } catch (e) {
      setRagInitStatus("error");
      setRagError(e instanceof Error ? e.message : "Initialization failed");
    }
  }

  function handleCopySql() {
    navigator.clipboard.writeText(RAG_MIGRATION_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  }

  const supabaseUrl = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "";
  const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : "https://supabase.com/dashboard";

  function handleSave() {
    try {
      localStorage.setItem(API_KEYS_STORAGE, JSON.stringify(keys));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          API keys and preferences. Keys are stored locally and used when you run workflows.
        </p>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Key className="h-4 w-4" />
            API Keys
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Stored in your browser only; never sent to our servers. Required for LLM nodes (OpenAI,
            Anthropic, Google).
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="openai-key" className="text-zinc-400">
                OpenAI (GPT)
              </Label>
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={keys.OPENAI_API_KEY}
                onChange={(e) =>
                  setKeys((k) => ({ ...k, OPENAI_API_KEY: e.target.value }))
                }
                className="mt-1 border-zinc-700 bg-zinc-950"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="anthropic-key" className="text-zinc-400">
                Anthropic (Claude)
              </Label>
              <Input
                id="anthropic-key"
                type="password"
                placeholder="sk-ant-..."
                value={keys.ANTHROPIC_API_KEY}
                onChange={(e) =>
                  setKeys((k) => ({ ...k, ANTHROPIC_API_KEY: e.target.value }))
                }
                className="mt-1 border-zinc-700 bg-zinc-950"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="google-key" className="text-zinc-400">
                Google (Gemini)
              </Label>
              <Input
                id="google-key"
                type="password"
                placeholder="..."
                value={keys.GOOGLE_API_KEY}
                onChange={(e) =>
                  setKeys((k) => ({ ...k, GOOGLE_API_KEY: e.target.value }))
                }
                className="mt-1 border-zinc-700 bg-zinc-950"
                autoComplete="off"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="mt-6 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            {saved ? "Saved" : "Save keys"}
          </button>
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Database className="h-4 w-4" />
            RAG Setup (one-time)
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Initialize the documents table and match functions for RAG. Paste your Supabase database connection string (Project Settings → Database → Connection string), or use the fallback below.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="db-url" className="text-zinc-400">
                Database URL
              </Label>
              <Input
                id="db-url"
                type="password"
                placeholder="postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                className="mt-1 border-zinc-700 bg-zinc-950"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleInitRag}
                disabled={!dbUrl.trim() || ragInitStatus === "loading"}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
              >
                {ragInitStatus === "loading" ? "Initializing…" : "Initialize RAG"}
              </button>
              {ragInitStatus === "success" && (
                <span className="text-sm text-emerald-400">Done.</span>
              )}
            </div>
            {ragInitStatus === "error" && (
              <p className="text-xs text-red-400">{ragError}</p>
            )}
          </div>
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-500">Or run the migration manually:</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
              >
                <Copy className="h-3 w-3" />
                {sqlCopied ? "Copied" : "Copy SQL"}
              </button>
              <a
                href={sqlEditorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
              >
                <ExternalLink className="h-3 w-3" />
                Open Supabase SQL Editor
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
