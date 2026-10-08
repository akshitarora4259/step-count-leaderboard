import type { FitbitConnectionRow, StepEntry } from "@/lib/supabase";

/**
 * Local-dev-only in-memory fallback store.
 *
 * Used when real backing credentials aren't configured, so the Fitbit
 * connect/sync flow and leaderboard work end-to-end with zero setup. This is
 * NOT persisted anywhere (resets on server restart) and NOT suitable for
 * production/multi-instance deployments — it exists purely so contributors
 * (and this event's organizer) can try the app locally before wiring up a
 * real Supabase project and/or real Fitbit OAuth credentials.
 *
 * We stash the arrays on `globalThis` so they survive Next.js dev-mode hot
 * reloads of this module (which would otherwise reset a plain module-level
 * variable on every edit).
 */
declare global {
  var __stepCountMemoryStore: StepEntry[] | undefined;
  var __fitbitConnectionsMemoryStore: FitbitConnectionRow[] | undefined;
}

function stepsStore(): StepEntry[] {
  if (!globalThis.__stepCountMemoryStore) {
    globalThis.__stepCountMemoryStore = [];
  }
  return globalThis.__stepCountMemoryStore;
}

function connectionsStore(): FitbitConnectionRow[] {
  if (!globalThis.__fitbitConnectionsMemoryStore) {
    globalThis.__fitbitConnectionsMemoryStore = [];
  }
  return globalThis.__fitbitConnectionsMemoryStore;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** Insert a new entry, or update the existing one for the same (name, entry_date). */
export function upsertStepEntry(input: {
  name: string;
  email: string | null;
  steps: number;
  entry_date: string;
}): StepEntry {
  const rows = stepsStore();
  const existing = rows.find(
    (row) => row.name === input.name && row.entry_date === input.entry_date
  );

  if (existing) {
    existing.email = input.email;
    existing.steps = input.steps;
    return existing;
  }

  const entry: StepEntry = {
    id: randomId(),
    name: input.name,
    email: input.email,
    steps: input.steps,
    entry_date: input.entry_date,
    created_at: new Date().toISOString(),
  };
  rows.push(entry);
  return entry;
}

/** All entries with entry_date within [startDate, endDate] (inclusive, ISO strings). */
export function getStepEntriesInRange(startDate: string, endDate: string): StepEntry[] {
  return stepsStore().filter((row) => row.entry_date >= startDate && row.entry_date <= endDate);
}

/** Removes all step entries for a participant (used on Fitbit disconnect). */
export function deleteStepEntriesForName(name: string): void {
  const rows = stepsStore();
  const lower = name.toLowerCase();
  const remaining = rows.filter((row) => row.name.toLowerCase() !== lower);
  globalThis.__stepCountMemoryStore = remaining;
}

// ---------------------------------------------------------------------------
// Fitbit connections
// ---------------------------------------------------------------------------

export function upsertFitbitConnection(
  input: Omit<FitbitConnectionRow, "id" | "connected_at" | "updated_at">
): FitbitConnectionRow {
  const rows = connectionsStore();
  const lower = input.name.toLowerCase();
  const existing = rows.find((row) => row.name.toLowerCase() === lower);
  const now = new Date().toISOString();

  if (existing) {
    Object.assign(existing, input, { updated_at: now });
    return existing;
  }

  const entry: FitbitConnectionRow = {
    id: randomId(),
    connected_at: now,
    updated_at: now,
    ...input,
  };
  rows.push(entry);
  return entry;
}

export function getFitbitConnection(name: string): FitbitConnectionRow | null {
  const lower = name.toLowerCase();
  return connectionsStore().find((row) => row.name.toLowerCase() === lower) ?? null;
}

export function deleteFitbitConnection(name: string): void {
  const lower = name.toLowerCase();
  globalThis.__fitbitConnectionsMemoryStore = connectionsStore().filter(
    (row) => row.name.toLowerCase() !== lower
  );
}

export function listFitbitConnections(): FitbitConnectionRow[] {
  return connectionsStore();
}
