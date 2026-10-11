import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";
import { getMockAuthEmail } from "@/lib/mockAuth";

/**
 * The single source of truth for "who is making this request" across every
 * API route that used to trust a self-reported `name`/`email` field. Real
 * mode resolves it from the Supabase Auth session cookie (set via email
 * OTP); mock mode (no Supabase configured) resolves it from the local demo
 * cookie set by `/api/auth/verify-otp`.
 *
 * `userId` is the authorization boundary everywhere a connection/steps row
 * is written or deleted — never a client-supplied name.
 */
export type Identity = { userId: string; email: string };

function mockUserId(email: string): string {
  const slug = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return `mock-auth-${slug || "user"}`;
}

export async function getCurrentIdentity(): Promise<Identity | null> {
  if (!isSupabaseConfigured()) {
    const email = await getMockAuthEmail();
    return email ? { userId: mockUserId(email), email } : null;
  }

  const supabase = await createSupabaseRouteClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return { userId: data.user.id, email: data.user.email };
}
