import { upsertConnection } from "@/lib/fitbitConnections";
import { upsertDailySteps } from "@/lib/steps";
import { getWeekRange, todayISODate, toISODate } from "@/lib/week";

/**
 * "Mock connect" — simulates a successful Fitbit connection + a few days of
 * synced step data, without any real Fitbit OAuth credentials. Used when
 * FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET aren't set, so the full
 * connect → synced data → leaderboard → disconnect flow can be demoed
 * locally with zero external setup.
 */

function randomDailySteps(): number {
  return Math.floor(3000 + Math.random() * 12000); // a plausible 3,000–15,000 daily range
}

function nextISODay(iso: string): string {
  // Parse as local-time components (not `new Date(iso)`/`toISOString()`,
  // which convert through UTC and can walk the date backwards — or never
  // reach `today` at all, infinite-looping the caller — in timezones ahead
  // of UTC).
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return toISODate(date);
}

export async function connectMock(name: string, email: string | null): Promise<void> {
  await upsertConnection({
    name,
    email,
    fitbitUserId: "mock-user",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    // Far-future expiry — mock connections never need a real token refresh.
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    isMock: true,
  });

  const { startDate } = getWeekRange();
  const today = todayISODate();

  // Sample data for every day from the start of the current week through
  // today (never future days), so the leaderboard has something to show
  // immediately after a mock "connect".
  for (let day = startDate; day <= today; day = nextISODay(day)) {
    await upsertDailySteps({ name, email, steps: randomDailySteps(), entry_date: day });
  }
}
