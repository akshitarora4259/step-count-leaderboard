import type { StepEntry } from "@/lib/supabase";

/**
 * Local-dev-only in-memory fallback store.
 *
 * Used when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY aren't
 * configured, so the submission form and leaderboard work end-to-end with
 * zero setup. This is NOT persisted anywhere (resets on server restart) and
 * NOT suitable for production/multi-instance deployments — it exists purely
 * so contributors (and this event's organizer) can try the app locally
 * before wiring up a real Supabase project.
 *
 * We stash the array on `globalThis` so it survives Next.js dev-mode hot
 * reloads of this module (which would otherwise reset a plain module-level
 * variable on every edit).
 */
declare global {
  var __stepCountMemoryStore: StepEntry[] | undefined;
}

function store(): StepEntry[] {
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

/** Insert a new entry, or update the existing one for the same (name, entry_date). */
export function upsertStepEntry(input: {
  name: string;
  email: string | null;
  steps: number;
  entry_date: string;
  screenshot_url: string | null;
}): StepEntry {
  const rows = store();
  const existing = rows.find(
    (row) => row.name === input.name && row.entry_date === input.entry_date
  );

  if (existing) {
    existing.email = input.email;
    existing.steps = input.steps;
    if (input.screenshot_url) {
      existing.screenshot_url = input.screenshot_url;
    }
    return existing;
  }

  const entry: StepEntry = {
    id: randomId(),
    name: input.name,
    email: input.email,
    steps: input.steps,
    entry_date: input.entry_date,
    created_at: new Date().toISOString(),
    screenshot_url: input.screenshot_url,
  };
  rows.push(entry);
  return entry;
}

/** All entries with entry_date within [startDate, endDate] (inclusive, ISO strings). */
export function getStepEntriesInRange(startDate: string, endDate: string): StepEntry[] {
  return store().filter((row) => row.entry_date >= startDate && row.entry_date <= endDate);
}
