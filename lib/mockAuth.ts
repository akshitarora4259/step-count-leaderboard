import { cookies } from "next/headers";

/**
 * Local-dev-only mock auth "session" — a plain HttpOnly cookie storing the
 * email the user typed into the demo-mode login gate on `/`. Used ONLY when
 * `isSupabaseConfigured()` is false (no real Supabase project wired up yet),
 * so the whole login → name → Connect Fitbit flow can still be tried with
 * zero setup, same spirit as the existing mock Fitbit connect.
 *
 * This is intentionally not cryptographically signed: it's local-dev-only,
 * never used once real Supabase Auth is configured, and carries no
 * sensitive data (just an email the user themselves typed in).
 */
const MOCK_AUTH_COOKIE = "scl_mock_auth_email";

export async function getMockAuthEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get(MOCK_AUTH_COOKIE)?.value || null;
}

export async function setMockAuthEmail(email: string): Promise<void> {
  const store = await cookies();
  store.set(MOCK_AUTH_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearMockAuthEmail(): Promise<void> {
  const store = await cookies();
  store.delete(MOCK_AUTH_COOKIE);
}
