import { NextResponse } from "next/server";
import { getConnectionByUserId } from "@/lib/fitbitConnections";
import { maybeLazySync } from "@/lib/fitbitSync";
import { getCurrentIdentity } from "@/lib/identity";
import { getStepsInRange } from "@/lib/steps";
import { getWeekRange, toISODate } from "@/lib/week";

export type ProfileDay = { date: string; steps: number };

export type ProfileResponse = {
  name: string;
  totalSteps: number;
  daysLogged: number;
  dailyAverage: number;
  rank: number | null;
  participants: number;
  daily: ProfileDay[];
  badges: string[];
};

/**
 * Lightweight "your profile" data for the connected participant's own card —
 * their rank, this week's daily step breakdown, and a couple of simple
 * achievement badges. Reuses the same steps-table aggregation the
 * leaderboard uses so rank stays consistent between the two views.
 *
 * Identity (and the display `name` used for the lookup) comes from the
 * signed-in session's Fitbit connection, not a client-supplied `name` query
 * param — this guarantees a caller can only ever see their own profile.
 */
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const conn = await getConnectionByUserId(identity.userId);
  if (!conn) {
    return NextResponse.json({ error: "No Fitbit connection found." }, { status: 404 });
  }
  const name = conn.name;

  const { start, startDate, endDate } = getWeekRange();

  await maybeLazySync();

  let rows: { name: string; steps: number; entry_date: string }[];
  try {
    rows = await getStepsInRange(startDate, endDate);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load profile." },
      { status: 500 }
    );
  }

  const byName = new Map<string, number>();
  for (const row of rows) {
    byName.set(row.name, (byName.get(row.name) ?? 0) + row.steps);
  }

  const ranked = Array.from(byName.entries()).sort((a, b) => b[1] - a[1]);
  const matchIndex = ranked.findIndex(([n]) => n.toLowerCase() === name.toLowerCase());
  const rank = matchIndex === -1 ? null : matchIndex + 1;

  const ownRows = rows.filter((r) => r.name.toLowerCase() === name.toLowerCase());
  const stepsByDate = new Map(ownRows.map((r) => [r.entry_date, r.steps]));

  const daily: ProfileDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = toISODate(d);
    daily.push({ date: iso, steps: stepsByDate.get(iso) ?? 0 });
  }

  const totalSteps = ownRows.reduce((sum, r) => sum + r.steps, 0);
  const daysLogged = ownRows.length;
  const dailyAverage = daysLogged ? Math.round(totalSteps / daysLogged) : 0;

  const badges: string[] = [];
  if (daysLogged >= 1) badges.push("First Steps");
  if (daysLogged >= 5) badges.push("5-Day Streak");
  if (daysLogged >= 7) badges.push("Perfect Week");
  if (dailyAverage >= 10_000) badges.push("10K Club");

  const response: ProfileResponse = {
    name,
    totalSteps,
    daysLogged,
    dailyAverage,
    rank,
    participants: ranked.length,
    daily,
    badges,
  };

  return NextResponse.json(response);
}
