import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";
import { setMockAuthEmail } from "@/lib/mockAuth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step 2 of email-OTP login: verifies the 6-digit code and establishes the
 * session (sets the HttpOnly Supabase auth cookies via the response).
 *
 * Mock mode (no Supabase configured): skips real OTP entirely and logs the
 * user in with whatever email they typed, by setting a local demo-mode
 * cookie — no `token` required in the request body.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    await setMockAuthEmail(email);
    return NextResponse.json({ ok: true, user: { email } });
  }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const supabase = await createSupabaseRouteClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error || !data.user?.email) {
    return NextResponse.json({ error: error?.message ?? "Invalid or expired code." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user: { email: data.user.email } });
}
