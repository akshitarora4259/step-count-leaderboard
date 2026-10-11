import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-initialized Supabase client (public anon key).
 *
 * We avoid reading env vars (and constructing the client) at module load
 * time so that `next build` never hard-fails when NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_SUPABASE_ANON_KEY aren't set (e.g. CI build checks, or before
 * the real Supabase project is wired up). The client is only created the
 * first time it's actually needed, at request time.
 *
 * Note: this is deliberately NOT prefixed with NEXT_PUBLIC_ — it's only
 * ever read server-side (Route Handlers, middleware), so it doesn't need
 * to be inlined into the client bundle, and Supabase's current dashboard
 * rejects "public" in custom env var names it suggests.
 */
let client: SupabaseClient | null = null;

/** True once NEXT_PUBLIC_SUPABASE_URL / NEXT_SUPABASE_ANON_KEY are both set. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_SUPABASE_ANON_KEY (see README.md)."
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
 * Used server-side only: to write `steps` rows (the anon key's public
 * write access was revoked in migration 0005 — all writes go through a
 * route that has already verified the caller's session) and to upload/
 * delete files in the private `step-screenshots` Storage bucket (see
 * lib/screenshotStorage.ts), which is RLS'd so the anon key can't reach
 * another user's files.
 */
let adminClient: SupabaseClient | null = null;

/**
 * Decodes the unsigned `role` claim out of a Supabase API key's JWT payload
 * (no signature verification — we're not authenticating anything with
 * this, just reading a non-secret claim for diagnostics). Returns null if
 * the token isn't a parseable JWT. Used to confirm at runtime whether
 * SUPABASE_SERVICE_ROLE_KEY actually holds a service_role token rather
 * than, e.g., the anon key pasted into the wrong env var by mistake.
 */
export function getJwtRole(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const role = JSON.parse(payload)?.role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

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
        "SUPABASE_SERVICE_ROLE_KEY (see README.md) — required to write steps/upload screenshots."
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
  /** Owning Supabase Auth user — the real authorization boundary (see lib/identity.ts). */
  user_id: string | null;
  steps: number;
  entry_date: string;
  /** Path/URL of the uploaded screenshot this step count was OCR'd from, if any. */
  screenshot_url: string | null;
  created_at: string;
};
