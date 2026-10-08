import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getWeekRange } from "@/lib/week";

export type LeaderboardEntry = {
  name: string;
  totalSteps: number;
  daysLogged: number;
  dailyAverage: number;
};

export async function GET() {
  const { startDate, endDate } = getWeekRange();

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured." },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("steps")
    .select("name, steps, entry_date")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byName = new Map<string, { totalSteps: number; daysLogged: number }>();
  for (const row of data ?? []) {
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

  return NextResponse.json({ leaderboard, startDate, endDate });
}
