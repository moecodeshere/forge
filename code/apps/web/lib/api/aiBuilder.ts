import type { Edge } from "@xyflow/react";

import type { ForgeNode } from "@/lib/stores/graphStore";
import { getBrowserSupabaseClient } from "@/lib/supabase";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface WorkflowSuggestion {
  template_id?: string | null;
  template_name?: string | null;
  rationale: string;
  parameters?: Record<string, unknown> | null;
  nodes: ForgeNode[];
  edges: Edge[];
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

export async function suggestWorkflow(prompt: string): Promise<WorkflowSuggestion> {
  const headers = await withAuthHeaders();
  const response = await fetch(`${apiBaseUrl}/ai-builder/suggest-workflow`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(String((err as { detail?: string }).detail ?? "Failed to suggest workflow"));
  }
  return (await response.json()) as WorkflowSuggestion;
}

export interface SuggestionTelemetryEvent {
  event_type: "applied" | "regenerated";
  template_id?: string | null;
  template_name?: string | null;
  prompt: string;
}

export async function logSuggestionTelemetry(
  event: SuggestionTelemetryEvent,
): Promise<void> {
  try {
    const headers = await withAuthHeaders();
    const response = await fetch(`${apiBaseUrl}/ai-builder/suggest-workflow/telemetry`, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      // Telemetry is best-effort; do not surface errors to the user.
      console.warn("Failed to send AI suggestion telemetry");
    }
  } catch {
    // Swallow network / auth errors for telemetry.
  }
}

