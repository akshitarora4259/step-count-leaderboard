import { NextResponse } from "next/server";
import { getStepsInRange } from "@/lib/steps";
import { getWeekRange } from "@/lib/week";

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
  /** Average of (daysLogged / 7) across participants, as a whole percentage. */
  completionPercent: number;
};

export async function GET() {
  const { startDate, endDate } = getWeekRange();

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
  const completionSum = leaderboard.reduce((sum, entry) => sum + entry.daysLogged / 7, 0);
  const stats: LeaderboardStats = {
    participants: leaderboard.length,
    totalSteps,
    averageSteps: leaderboard.length ? Math.round(totalSteps / leaderboard.length) : 0,
    completionPercent: leaderboard.length
      ? Math.round((completionSum / leaderboard.length) * 100)
      : 0,
  };

  return NextResponse.json({ leaderboard, startDate, endDate, stats });
}
