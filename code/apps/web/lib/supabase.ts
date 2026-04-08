// Browser-only Supabase client.
// Safe to import in "use client" components.
// For server components / server actions use lib/supabase-server.ts

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabaseClient() {
  if (!_client) {
    _client = createBrowserClient(url, anonKey);
  }
  return _client;
}
