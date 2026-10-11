import { NextResponse } from "next/server";
import { getStepsInRange } from "@/lib/steps";
import { getEventWeekRange, todayISODate } from "@/lib/week";
import { EVENT_END_DATE } from "@/lib/constants";

/** Standard average stride-length assumption: ~0.000762 km per step (~762 steps/km). */
const KM_PER_STEP = 0.000762;

export type LeaderboardEntry = {
  name: string;
  totalSteps: number;
  daysLogged: number;
  dailyAverage: number;
};

export type LeaderboardStats = {
  participants: number;
  totalSteps: number;
  averageSteps: number;
  /** Days left in the event window (inclusive of today), floored at 0. */
  daysRemaining: number;
  /** Real aggregated totalSteps converted to kilometers via a standard average stride length. */
  totalDistanceKm: number;
};

export async function GET() {
  const { startDate, endDate } = getEventWeekRange();

  let rows: { name: string; steps: number; entry_date: string }[];
  try {
    rows = await getStepsInRange(startDate, endDate);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load leaderboard." },
      { status: 500 }
    );
  }

  const byName = new Map<string, { totalSteps: number; daysLogged: number }>();
  for (const row of rows) {
    const existing = byName.get(row.name) ?? { totalSteps: 0, daysLogged: 0 };
    existing.totalSteps += row.steps;
    existing.daysLogged += 1;
    byName.set(row.name, existing);
  }

  const leaderboard: LeaderboardEntry[] = Array.from(byName.entries())
    .map(([name, { totalSteps, daysLogged }]) => ({
      name,
      totalSteps,
      daysLogged,
      dailyAverage: Math.round(totalSteps / daysLogged),
    }))
    .sort((a, b) => b.totalSteps - a.totalSteps);

  const totalSteps = leaderboard.reduce((sum, entry) => sum + entry.totalSteps, 0);
  const stats: LeaderboardStats = {
    participants: leaderboard.length,
    totalSteps,
    averageSteps: leaderboard.length ? Math.round(totalSteps / leaderboard.length) : 0,
    daysRemaining: computeDaysRemaining(todayISODate()),
    totalDistanceKm: Math.round(totalSteps * KM_PER_STEP * 10) / 10,
  };

  return NextResponse.json({ leaderboard, startDate, endDate, stats });
}

/** Days left in the event window (inclusive of today), floored at 0 once it's over. */
function computeDaysRemaining(today: string): number {
  if (today > EVENT_END_DATE) return 0;
  const [ty, tm, td] = today.split("-").map(Number);
  const [ey, em, ed] = EVENT_END_DATE.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const endDate = new Date(ey, em - 1, ed);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((endDate.getTime() - todayDate.getTime()) / msPerDay) + 1);
}
