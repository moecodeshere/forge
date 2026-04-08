import type { Edge } from "@xyflow/react";

import type { ForgeNode } from "@/lib/stores/graphStore";
import { getBrowserSupabaseClient } from "@/lib/supabase";

export interface GraphPayload {
  title: string;
  description?: string;
  json_content: {
    version: number;
    nodes: ForgeNode[];
    edges: Edge[];
    viewport: { x: number; y: number; zoom: number };
  };
}

export interface GraphRecord extends GraphPayload {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  version: number;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  let detail = "";
  try {
    const payload = (await response.json()) as { detail?: string };
    detail = payload.detail ?? "";
  } catch {
    // Ignore JSON parsing errors and fall back to status text.
  }
  const reason = detail || response.statusText || fallback;
  return `${fallback} (${response.status}): ${reason}`;
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
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function listGraphs(): Promise<GraphRecord[]> {
  const headers = await withAuthHeaders();
  const response = await fetch(`${apiBaseUrl}/graphs`, { headers, cache: "no-store" });
  if (!response.ok) {
    const msg = await getApiErrorMessage(response, "Failed to list graphs");
    const err = new Error(msg);
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }
  const payload = (await response.json()) as { items?: GraphRecord[]; data?: GraphRecord[] };
  const items = payload.items ?? payload.data ?? [];
  return Array.isArray(items) ? items : [];
}

export async function getGraph(graphId: string): Promise<GraphRecord> {
  const headers = await withAuthHeaders();
  const response = await fetch(`${apiBaseUrl}/graphs/${graphId}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "Failed to load graph"));
  return (await response.json()) as GraphRecord;
}

export async function createGraph(payload: GraphPayload): Promise<GraphRecord> {
  const headers = await withAuthHeaders();
  const response = await fetch(`${apiBaseUrl}/graphs`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "Failed to create graph"));
  return (await response.json()) as GraphRecord;
}

export async function updateGraph(
  graphId: string,
  payload: Partial<GraphPayload & { title?: string; description?: string }>,
): Promise<GraphRecord> {
  const headers = await withAuthHeaders();
  const response = await fetch(`${apiBaseUrl}/graphs/${graphId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "Failed to update graph"));
  return (await response.json()) as GraphRecord;
}

export async function deleteGraph(graphId: string): Promise<void> {
  const headers = await withAuthHeaders();
  const response = await fetch(`${apiBaseUrl}/graphs/${graphId}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "Failed to delete graph"));
}
