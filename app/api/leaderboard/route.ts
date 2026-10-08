import { NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getStepEntriesInRange } from "@/lib/memoryStore";
import { getWeekRange } from "@/lib/week";

export type LeaderboardEntry = {
  name: string;
  totalSteps: number;
  daysLogged: number;
  dailyAverage: number;
  /** Screenshot from the most recent entry_date this week, for spot-checking. */
  latestScreenshotUrl: string | null;
};

export async function GET() {
  const { startDate, endDate } = getWeekRange();

  let rows: { name: string; steps: number; entry_date: string; screenshot_url: string | null }[];

  if (!isSupabaseConfigured()) {
    // Local dev fallback: no Supabase env vars configured.
    rows = getStepEntriesInRange(startDate, endDate);
  } else {
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
      .select("name, steps, entry_date, screenshot_url")
      .gte("entry_date", startDate)
      .lte("entry_date", endDate);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows = data ?? [];
  }

  const byName = new Map<
    string,
    { totalSteps: number; daysLogged: number; latestDate: string; latestScreenshotUrl: string | null }
  >();
  for (const row of rows) {
    const existing = byName.get(row.name) ?? {
      totalSteps: 0,
      daysLogged: 0,
      latestDate: "",
      latestScreenshotUrl: null,
    };
    existing.totalSteps += row.steps;
    existing.daysLogged += 1;
    if (row.entry_date >= existing.latestDate) {
      existing.latestDate = row.entry_date;
      existing.latestScreenshotUrl = row.screenshot_url ?? existing.latestScreenshotUrl;
    }
    byName.set(row.name, existing);
  }

  const leaderboard: LeaderboardEntry[] = Array.from(byName.entries())
    .map(([name, { totalSteps, daysLogged, latestScreenshotUrl }]) => ({
      name,
      totalSteps,
      daysLogged,
      dailyAverage: Math.round(totalSteps / daysLogged),
      latestScreenshotUrl,
    }))
    .sort((a, b) => b.totalSteps - a.totalSteps);

  return NextResponse.json({ leaderboard, startDate, endDate });
}

