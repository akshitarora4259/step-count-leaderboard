import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-initialized Supabase client.
 *
 * We avoid reading env vars (and constructing the client) at module load
 * time so that `next build` never hard-fails when NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY aren't set (e.g. CI build checks, or before
 * the real Supabase project is wired up). The client is only created the
 * first time it's actually needed, at request time.
 */
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (see README.md)."
    );
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  return client;
}

export type StepEntry = {
  id: string;
  name: string;
  email: string | null;
  steps: number;
  entry_date: string;
  created_at: string;
};
