import { getBrowserSupabaseClient } from "@/lib/supabase";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ExecutionRun {
  id: string;
  graph_id: string;
  status: string;
  started_at: string;
  completed_at?: string;
}

export interface ExecutionDetail extends ExecutionRun {
  user_id: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

async function withAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getBrowserSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Missing user session. Please sign in again.");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

const API_KEYS_STORAGE = "forge-api-keys";

export interface IngestFileResult {
  filename: string;
  chunks_ingested: number;
  skipped?: string;
}

/**
 * Upload one or more files (documents or images) and ingest as RAG document chunks.
 * Collection ID must match the RAG node's collection_id config (or use a default UUID).
 * Sends OpenAI API key from Run settings so embedding succeeds.
 */
export async function ingestRagDocuments(
  graphId: string,
  files: File | File[],
  collectionId: string
): Promise<{
  status: string;
  collection_id: string;
  chunks_ingested?: number;
  files?: IngestFileResult[];
}> {
  const headers = await withAuthHeaders();
  const formData = new FormData();
  const fileList = Array.isArray(files) ? files : [files];
  if (fileList.length === 0) {
    throw new Error("No files to upload");
  }
  if (fileList.length === 1) {
    const single = fileList[0];
    if (single) formData.append("file", single);
  } else {
    for (const f of fileList) {
      formData.append("files", f);
    }
  }

  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE);
    if (raw) {
      const keys = JSON.parse(raw) as { OPENAI_API_KEY?: string };
      if (keys.OPENAI_API_KEY?.trim()) {
        formData.append("openai_api_key", keys.OPENAI_API_KEY.trim());
      }
    }
  } catch {
    /* ignore */
  }

  const url = new URL(`${apiBaseUrl}/executions/${graphId}/documents`);
  url.searchParams.set("collection_id", collectionId);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const err = (await response.json()) as { detail?: string };
    throw new Error(err.detail ?? `Upload failed (${response.status})`);
  }

  return (await response.json()) as {
    status: string;
    collection_id: string;
    chunks_ingested?: number;
    files?: IngestFileResult[];
  };
}

/**
 * List executions for the current user, optionally filtered by graph ID.
 */
export async function listExecutions(graphId?: string): Promise<{ runs: ExecutionRun[] }> {
  const headers = await withAuthHeaders();
  const url = new URL(`${apiBaseUrl}/executions`);
  if (graphId) url.searchParams.set("graph_id", graphId);
  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Failed to list executions (${response.status})`);
  }
  return response.json() as Promise<{ runs: ExecutionRun[] }>;
}

/**
 * Get a single execution by ID.
 */
export async function getExecution(runId: string): Promise<ExecutionDetail> {
  const headers = await withAuthHeaders();
  const response = await fetch(`${apiBaseUrl}/executions/${runId}`, { headers });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Execution not found (${response.status})`);
  }
  return response.json() as Promise<ExecutionDetail>;
}
