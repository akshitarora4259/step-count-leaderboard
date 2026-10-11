import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step 1 of email-OTP login: sends a 6-digit code to the given address via
 * Supabase Auth. In mock mode (no Supabase project configured) this is a
 * no-op — `verify-otp` logs the user in instantly without a code, matching
 * the existing "demo mode" pattern used by mock Fitbit connect.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    // Demo mode: nothing to send — the client should call /api/auth/verify-otp
    // directly, which logs the user in immediately.
    return NextResponse.json({ ok: true, mockMode: true });
  }

  const supabase = await createSupabaseRouteClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
