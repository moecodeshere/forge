import { getBrowserSupabaseClient } from "@/lib/supabase";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export async function initRagDatabase(databaseUrl: string): Promise<{ status: string; message: string }> {
  const headers = await withAuthHeaders();
  const response = await fetch(`${apiBaseUrl}/setup/init-rag`, {
    method: "POST",
    headers,
    body: JSON.stringify({ database_url: databaseUrl }),
  });

  if (!response.ok) {
    const err = (await response.json()) as { detail?: string };
    throw new Error(err.detail ?? `Initialization failed (${response.status})`);
  }

  return (await response.json()) as { status: string; message: string };
}
