import type { StepEntry } from "@/lib/supabase";

/**
 * Local-dev-only in-memory fallback store.
 *
 * Used when real backing credentials aren't configured, so the screenshot
 * upload + OCR flow and leaderboard work end-to-end with zero setup. This is
 * NOT persisted anywhere (resets on server restart) and NOT suitable for
 * production/multi-instance deployments — it exists purely so contributors
 * (and this event's organizer) can try the app locally before wiring up a
 * real Supabase project.
 *
 * We stash the array on `globalThis` so it survives Next.js dev-mode hot
 * reloads of this module (which would otherwise reset a plain module-level
 * variable on every edit).
 */
declare global {
  var __stepCountMemoryStore: StepEntry[] | undefined;
}

function stepsStore(): StepEntry[] {
  if (!globalThis.__stepCountMemoryStore) {
    globalThis.__stepCountMemoryStore = [];
  }
  return globalThis.__stepCountMemoryStore;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Insert a new entry, or update the existing one for the same (user_id, entry_date). */
export function upsertStepEntry(input: {
  name: string;
  email: string | null;
  userId: string;
  steps: number;
  entry_date: string;
  screenshot_url: string | null;
}): StepEntry {
  const rows = stepsStore();
  const existing = rows.find(
    (row) => row.user_id === input.userId && row.entry_date === input.entry_date
  );

  if (existing) {
    existing.name = input.name;
    existing.email = input.email;
    existing.steps = input.steps;
    existing.screenshot_url = input.screenshot_url;
    return existing;
  }

  const entry: StepEntry = {
    id: randomId(),
    name: input.name,
    email: input.email,
    user_id: input.userId,
    steps: input.steps,
    entry_date: input.entry_date,
    screenshot_url: input.screenshot_url,
    created_at: new Date().toISOString(),
  };
  rows.push(entry);
  return entry;
}

/** All entries with entry_date within [startDate, endDate] (inclusive, ISO strings). */
export function getStepEntriesInRange(startDate: string, endDate: string): StepEntry[] {
  return stepsStore().filter((row) => row.entry_date >= startDate && row.entry_date <= endDate);
}

/** The signed-in caller's own entry for a specific date, if any. */
export function getStepEntryForUserAndDate(userId: string, entry_date: string): StepEntry | null {
  return stepsStore().find((row) => row.user_id === userId && row.entry_date === entry_date) ?? null;
}

/** Removes all step entries for a participant (kept for completeness/local-dev resets). */
export function deleteStepEntriesForUserId(userId: string): void {
  const rows = stepsStore();
  const remaining = rows.filter((row) => row.user_id !== userId);
  globalThis.__stepCountMemoryStore = remaining;
}
