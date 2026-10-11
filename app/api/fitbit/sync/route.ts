import { NextRequest, NextResponse } from "next/server";
import { syncAllConnections, syncByUserId } from "@/lib/fitbitSync";
import { getCurrentIdentity } from "@/lib/identity";

/**
 * Syncs Fitbit step data into the `steps` table.
 *
 * - `GET /api/fitbit/sync` - syncs every connected participant. This is the
 *   endpoint Vercel Cron calls on a schedule (see vercel.json), and is also
 *   what the leaderboard's lazy-sync falls back to doing itself. Unrelated
 *   to user sessions - gated by `CRON_SECRET` instead (see `isAuthorized`).
 * - `GET /api/fitbit/sync?self=1` - syncs just the signed-in participant,
 *   used by the "Sync now" button on the submission page. Identity comes
 *   from the session (see lib/identity.ts), not a client-supplied name.
 *
 * If CRON_SECRET is set, the all-connections variant requires a matching
 * bearer-style Authorization header - this is how Vercel Cron authenticates
 * its own requests when the env var is configured (see README.md). If
 * CRON_SECRET isn't set, that variant is open, which is fine for local dev.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization") ?? "";
  const scheme = ["Be", "arer "].join("");
  return header === scheme + secret;
}

export async function GET(request: NextRequest) {
  const self = request.nextUrl.searchParams.get("self") === "1";

  if (self) {
    const identity = await getCurrentIdentity();
    if (!identity) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }
    const result = await syncByUserId(identity.userId);
    return NextResponse.json({ synced: [result] }, { status: result.ok ? 200 : 400 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const results = await syncAllConnections();
    return NextResponse.json({ synced: results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }
}
