import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-initialized Supabase client (public anon key).
 *
 * We avoid reading env vars (and constructing the client) at module load
 * time so that `next build` never hard-fails when NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY aren't set (e.g. CI build checks, or before
 * the real Supabase project is wired up). The client is only created the
 * first time it's actually needed, at request time.
 */
let client: SupabaseClient | null = null;

/** True once NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are both set. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

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

/**
 * Lazily-initialized Supabase admin client (service role key).
 *
 * Used ONLY server-side, ONLY for the `fitbit_connections` table, which
 * stores encrypted OAuth tokens and must never be reachable via the public
 * anon key / client-side code. The service role key bypasses Row Level
 * Security, which is intentional here since `fitbit_connections` has RLS
 * enabled with no policies (see supabase/migrations/0003_fitbit_connections.sql) —
 * i.e. the anon key gets zero access to that table by design.
 */
let adminClient: SupabaseClient | null = null;

/** True once NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are both set. */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase admin environment variables. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY (see README.md) — required to store Fitbit OAuth tokens."
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return adminClient;
}

export type StepEntry = {
  id: string;
  name: string;
  email: string | null;
  steps: number;
  entry_date: string;
  created_at: string;
};

/**
 * Row shape for the `fitbit_connections` table (and its in-memory dev
 * mirror). `access_token` / `refresh_token` are stored already encrypted
 * (see lib/crypto.ts) — decrypt only right before calling Fitbit's API.
 */
export type FitbitConnectionRow = {
  id: string;
  name: string;
  email: string | null;
  fitbit_user_id: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  is_mock: boolean;
  connected_at: string;
  updated_at: string;
};
