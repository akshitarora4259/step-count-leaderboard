import { NextRequest, NextResponse } from "next/server";
import { syncAllConnections, syncByName } from "@/lib/fitbitSync";

/**
 * Syncs Fitbit step data into the `steps` table.
 *
 * - `GET /api/fitbit/sync` — syncs every connected participant. This is the
 *   endpoint Vercel Cron calls on a schedule (see vercel.json), and is also
 *   what the leaderboard's lazy-sync falls back to doing itself.
 * - `GET /api/fitbit/sync?name=Jane` — syncs just one participant, used by
 *   the "Sync now" button on the submission page.
 *
 * If CRON_SECRET is set, requests must include it as
 * `Authorization: Bearer <CRON_SECRET>` (this is how Vercel Cron
 * authenticates its own requests when the env var is configured — see
 * README.md). If CRON_SECRET isn't set, the endpoint is open, which is fine
 * for local dev and manual "Sync now" clicks.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const name = request.nextUrl.searchParams.get("name")?.trim();

  try {
    if (name) {
      const result = await syncByName(name);
      return NextResponse.json({ synced: [result] }, { status: result.ok ? 200 : 400 });
    }
    const results = await syncAllConnections();
    return NextResponse.json({ synced: results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }
}
