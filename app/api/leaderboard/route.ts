import { NextResponse } from "next/server";
import { listConnections } from "@/lib/fitbitConnections";
import { maybeLazySync } from "@/lib/fitbitSync";
import { getStepsInRange } from "@/lib/steps";
import { getWeekRange } from "@/lib/week";

export type LeaderboardEntry = {
  name: string;
  totalSteps: number;
  daysLogged: number;
  dailyAverage: number;
  /** Whether this participant currently has a Fitbit connection. */
  fitbitConnected: boolean;
  /** Whether that connection is a local demo/mock connection (no real Fitbit account). */
  isMock: boolean;
};

export type LeaderboardStats = {
  participants: number;
  totalSteps: number;
  averageSteps: number;
};

export async function GET() {
  const { startDate, endDate } = getWeekRange();

  // Best-effort, throttled: refresh any stale Fitbit connections' step data
  // before computing the leaderboard, so results stay reasonably fresh even
  // without Vercel Cron configured.
  await maybeLazySync();

  let rows: { name: string; steps: number; entry_date: string }[];
  try {
    rows = await getStepsInRange(startDate, endDate);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load leaderboard." },
      { status: 500 }
    );
  }

  const connectionByName = new Map<string, boolean>();
  try {
    for (const conn of await listConnections()) {
      connectionByName.set(conn.name.toLowerCase(), conn.isMock);
    }
  } catch {
    // Non-fatal — leaderboard totals still work even if connection lookup fails.
  }

  const byName = new Map<string, { totalSteps: number; daysLogged: number }>();
  for (const row of rows) {
    const existing = byName.get(row.name) ?? { totalSteps: 0, daysLogged: 0 };
    existing.totalSteps += row.steps;
    existing.daysLogged += 1;
    byName.set(row.name, existing);
  }

  const leaderboard: LeaderboardEntry[] = Array.from(byName.entries())
    .map(([name, { totalSteps, daysLogged }]) => {
      const isMock = connectionByName.get(name.toLowerCase());
      return {
        name,
        totalSteps,
        daysLogged,
        dailyAverage: Math.round(totalSteps / daysLogged),
        fitbitConnected: connectionByName.has(name.toLowerCase()),
        isMock: isMock ?? false,
      };
    })
    .sort((a, b) => b.totalSteps - a.totalSteps);

  const totalSteps = leaderboard.reduce((sum, entry) => sum + entry.totalSteps, 0);
  const stats = {
    participants: leaderboard.length,
    totalSteps,
    averageSteps: leaderboard.length ? Math.round(totalSteps / leaderboard.length) : 0,
  };

  return NextResponse.json({ leaderboard, startDate, endDate, stats });
}
