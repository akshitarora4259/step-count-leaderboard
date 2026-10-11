import { NextResponse } from "next/server";
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
 * Lightweight "your profile" data for the signed-in participant's own card —
 * their rank, this week's daily step breakdown (from uploaded screenshots),
 * and a couple of simple achievement badges. Reuses the same steps-table
 * aggregation the leaderboard uses so rank stays consistent between the
 * two views.
 *
 * Identity comes from the signed-in session (`user_id`), not a
 * client-supplied `name` — this both guarantees a caller can only ever see
 * their own entries and (fixing a subtlety the old Fitbit-connection-based
 * lookup had) can't be confused by two different participants picking the
 * same display name.
 */
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const { start, startDate, endDate } = getWeekRange();

  let rows;
  try {
    rows = await getStepsInRange(startDate, endDate);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load profile." },
      { status: 500 }
    );
  }

  const ownRows = rows.filter((r) => r.user_id === identity.userId);
  if (ownRows.length === 0) {
    return NextResponse.json(
      { error: "No step entries yet this week — upload a screenshot on the home page to get started." },
      { status: 404 }
    );
  }

  // Most recent upload's display name (participants can only have one name
  // "active" at a time in practice, but if it ever changed mid-week, the
  // latest one is what should show here).
  const name = ownRows[ownRows.length - 1].name;

  const byName = new Map<string, number>();
  for (const row of rows) {
    byName.set(row.name, (byName.get(row.name) ?? 0) + row.steps);
  }
  const ranked = Array.from(byName.entries()).sort((a, b) => b[1] - a[1]);
  const matchIndex = ranked.findIndex(([n]) => n.toLowerCase() === name.toLowerCase());
  const rank = matchIndex === -1 ? null : matchIndex + 1;

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
