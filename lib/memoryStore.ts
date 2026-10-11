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

/** Insert a new entry, or update the existing one for the same (user_id, entry_date). */
export function upsertStepEntry(input: {
  name: string;
  email: string | null;
  userId: string;
  steps: number;
  entry_date: string;
}): StepEntry {
  const rows = stepsStore();
  const existing = rows.find(
    (row) => row.user_id === input.userId && row.entry_date === input.entry_date
  );

  if (existing) {
    existing.name = input.name;
    existing.email = input.email;
    existing.steps = input.steps;
    return existing;
  }

  const entry: StepEntry = {
    id: randomId(),
    name: input.name,
    email: input.email,
    user_id: input.userId,
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
export function deleteStepEntriesForUserId(userId: string): void {
  const rows = stepsStore();
  const remaining = rows.filter((row) => row.user_id !== userId);
  globalThis.__stepCountMemoryStore = remaining;
}

// ---------------------------------------------------------------------------
// Fitbit connections
// ---------------------------------------------------------------------------

export function upsertFitbitConnection(
  input: Omit<FitbitConnectionRow, "id" | "connected_at" | "updated_at">
): FitbitConnectionRow {
  const rows = connectionsStore();

  // Mirrors the `fitbit_connections_fitbit_user_id_idx` partial unique index
  // added in supabase/migrations/0004 — a non-null fitbit_user_id can only
  // ever belong to one authenticated identity. The callback/mock-connect
  // flows already check this up front (via `assertFitbitUserIdAvailable`) to
  // produce a friendly error naming the existing owner; this is a defense-
  // in-depth backstop so direct/bypassing callers can't silently steal a
  // connection out from under another identity either.
  if (input.fitbit_user_id) {
    const conflicting = rows.find(
      (row) => row.fitbit_user_id === input.fitbit_user_id && row.user_id !== input.user_id
    );
    if (conflicting) {
      throw new Error(
        `This Fitbit account is already connected under the name "${conflicting.name}". Each Fitbit account can only join once.`
      );
    }
  }

  const existing = rows.find((row) => row.user_id === input.user_id);
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

/** The signed-in caller's own connection, if any. */
export function getFitbitConnectionByUserId(userId: string): FitbitConnectionRow | null {
  return connectionsStore().find((row) => row.user_id === userId) ?? null;
}

/** Case-sensitive lookup by Fitbit's opaque `user_id` — used to detect the
 * same real Fitbit account being linked under a second authenticated identity. */
export function getFitbitConnectionByFitbitUserId(fitbitUserId: string): FitbitConnectionRow | null {
  return connectionsStore().find((row) => row.fitbit_user_id === fitbitUserId) ?? null;
}

export function deleteFitbitConnectionByUserId(userId: string): void {
  globalThis.__fitbitConnectionsMemoryStore = connectionsStore().filter(
    (row) => row.user_id !== userId
  );
}

export function listFitbitConnections(): FitbitConnectionRow[] {
  return connectionsStore();
}
