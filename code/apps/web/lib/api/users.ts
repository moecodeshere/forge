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
    Authorization: `Bearer ${session.access_token}`,
  };
}

/**
 * Save API keys to the server (encrypted). Enables Run without re-entering keys.
 */
export async function saveUserKeys(keys: Record<string, string>): Promise<void> {
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(keys)) {
    if (v && String(v).trim()) filtered[k] = String(v).trim();
  }
  if (Object.keys(filtered).length === 0) return;

  const headers = await withAuthHeaders();
  const response = await fetch(`${apiBaseUrl}/users/me/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ keys: filtered }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Failed to save keys (${response.status})`);
  }
}
