import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentIdentity } from "@/lib/identity";

export type AuthStatusResponse = {
  /** True when no real Supabase project is configured — demo-mode login. */
  mockMode: boolean;
  user: { email: string } | null;
};

export async function GET() {
  const identity = await getCurrentIdentity();
  const response: AuthStatusResponse = {
    mockMode: !isSupabaseConfigured(),
    user: identity ? { email: identity.email } : null,
  };
  return NextResponse.json(response);
}
