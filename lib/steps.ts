import {
  getSupabaseAdminClient,
  getSupabaseClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";
import {
  deleteStepEntriesForUserId,
  getStepEntriesInRange,
  upsertStepEntry,
} from "@/lib/memoryStore";

/**
 * Shared steps-table storage abstraction. Writes (upsert/delete) go through
 * the service-role admin client, same as `fitbit_connections` — ownership
 * is enforced in application code (every caller must already have resolved
 * `userId` from a verified session, see lib/identity.ts) rather than via
 * Postgres RLS on a user-JWT'd client, so the anon key no longer needs
 * direct write access to `steps` (see migration 0005). Reads stay on the
 * plain anon client, backed by the public "Allow public read" policy, so
 * the leaderboard keeps working fully unauthenticated.
 */

export type StepsRow = { name: string; steps: number; entry_date: string };

export async function upsertDailySteps(input: {
  name: string;
  email: string | null;
  userId: string;
  steps: number;
  entry_date: string;
}): Promise<void> {
  if (!isSupabaseAdminConfigured()) {
    upsertStepEntry(input);
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("steps").upsert(
    {
      name: input.name,
      email: input.email,
      user_id: input.userId,
      steps: input.steps,
      entry_date: input.entry_date,
    },
    { onConflict: "user_id,entry_date" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

/** Removes all step entries for the signed-in caller's own identity (used on Fitbit disconnect). */
export async function deleteStepsForUserId(userId: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) {
    deleteStepEntriesForUserId(userId);
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("steps").delete().eq("user_id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

/** All step rows with entry_date within [startDate, endDate] (inclusive, ISO strings). */
export async function getStepsInRange(startDate: string, endDate: string): Promise<StepsRow[]> {
  if (!isSupabaseConfigured()) {
    return getStepEntriesInRange(startDate, endDate);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("steps")
    .select("name, steps, entry_date")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate);

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
