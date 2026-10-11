import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-aware Supabase client for use inside Route Handlers (App Router).
 *
 * Unlike `lib/supabase.ts`'s plain anon client (which never carries a user
 * session), this one reads/writes the HttpOnly auth cookies that
 * `@supabase/ssr` manages, so `supabase.auth.getUser()` reflects whoever is
 * actually signed in for *this* request. Only call this when
 * `isSupabaseConfigured()` is true — it throws otherwise.
 *
 * Must be constructed fresh per request (never cached/reused across
 * requests), per the `@supabase/ssr` docs.
 */
export async function createSupabaseRouteClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_SUPABASE_ANON_KEY (see README.md)."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Route Handlers can set cookies; Server Components cannot (the
          // `cookies()` store is read-only there). `middleware.ts` handles
          // the session refresh in that case, so this is safe to ignore.
        }
      },
    },
  });
}
