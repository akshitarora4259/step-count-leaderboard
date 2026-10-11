import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";
import { clearMockAuthEmail } from "@/lib/mockAuth";

export async function POST() {
  if (!isSupabaseConfigured()) {
    await clearMockAuthEmail();
    return NextResponse.json({ ok: true });
  }

  const supabase = await createSupabaseRouteClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
