import { fetchStepsForRange, refreshFitbitToken } from "@/lib/fitbit";
import {
  getConnection,
  listConnections,
  upsertConnection,
  type DecryptedConnection,
} from "@/lib/fitbitConnections";
import { upsertDailySteps } from "@/lib/steps";
import { getWeekRange, todayISODate } from "@/lib/week";

/** Refresh the token a little before it actually expires, to avoid race conditions. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * Syncs one participant's Fitbit step data for every day of the current
 * week (Mon–Sun) up to today, refreshing their access token first if it's
 * expired or close to it. Mock connections are a no-op here — their sample
 * data is generated once, at "connect" time (see lib/fitbitMock.ts).
 */
export async function syncParticipant(conn: DecryptedConnection): Promise<void> {
  if (conn.isMock) return;

  const { startDate, endDate } = getWeekRange();
  const today = todayISODate();
  const effectiveEnd = endDate < today ? endDate : today;

  let accessToken = conn.accessToken;
  const expiresAtMs = new Date(conn.expiresAt).getTime();
  if (Date.now() > expiresAtMs - REFRESH_SKEW_MS) {
    const refreshed = await refreshFitbitToken(conn.refreshToken);
    accessToken = refreshed.access_token;
    await upsertConnection({
      name: conn.name,
      email: conn.email,
      fitbitUserId: conn.fitbitUserId,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      isMock: false,
    });
  }

  const daily = await fetchStepsForRange(accessToken, startDate, effectiveEnd);
  for (const day of daily) {
    await upsertDailySteps({
      name: conn.name,
      email: conn.email,
      steps: day.steps,
      entry_date: day.date,
    });
  }
}

export type SyncResult = { name: string; ok: boolean; error?: string };

export async function syncByName(name: string): Promise<SyncResult> {
  const conn = await getConnection(name);
  if (!conn) {
    return { name, ok: false, error: "Not connected." };
  }
  try {
    await syncParticipant(conn);
    return { name, ok: true };
  } catch (err) {
    return { name, ok: false, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function syncAllConnections(): Promise<SyncResult[]> {
  const conns = await listConnections();
  const results: SyncResult[] = [];
  for (const conn of conns) {
    try {
      await syncParticipant(conn);
      results.push({ name: conn.name, ok: true });
    } catch (err) {
      results.push({
        name: conn.name,
        ok: false,
        error: err instanceof Error ? err.message : "Sync failed.",
      });
    }
  }
  return results;
}

declare global {
  var __lastLazyFitbitSyncAt: number | undefined;
}
const LAZY_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Best-effort, throttled sync triggered when the leaderboard loads, so step
 * data stays reasonably fresh even without Vercel Cron configured (and
 * without hammering Fitbit's API on every 30s leaderboard poll from every
 * open browser tab).
 */
export async function maybeLazySync(): Promise<void> {
  const last = globalThis.__lastLazyFitbitSyncAt ?? 0;
  if (Date.now() - last < LAZY_SYNC_MIN_INTERVAL_MS) return;
  globalThis.__lastLazyFitbitSyncAt = Date.now();
  try {
    await syncAllConnections();
  } catch {
    // Swallow — the leaderboard should still render with whatever data we
    // already have even if a sync attempt fails.
  }
}
