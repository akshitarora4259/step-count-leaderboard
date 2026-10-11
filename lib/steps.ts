import {
  getSupabaseAdminClient,
  getSupabaseClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";
import {
  deleteStepEntriesForUserId,
  getStepEntriesInRange,
  getStepEntryForUserAndDate,
  upsertStepEntry,
} from "@/lib/memoryStore";

/**
 * Shared steps-table storage abstraction. Writes (upsert/delete) go through
 * the service-role admin client — ownership is enforced in application code
 * (every caller must already have resolved `userId` from a verified
 * session, see lib/identity.ts) rather than via Postgres RLS on a
 * user-JWT'd client, so the anon key no longer needs direct write access to
 * `steps` (see migration 0005). Reads stay on the plain anon client, backed
 * by the public "Allow public read" policy, so the leaderboard keeps
 * working fully unauthenticated.
 */

export type StepsRow = {
  name: string;
  steps: number;
  entry_date: string;
  user_id: string | null;
};

export async function upsertDailySteps(input: {
  name: string;
  email: string | null;
  userId: string;
  steps: number;
  entry_date: string;
  screenshotUrl: string | null;
}): Promise<void> {
  if (!isSupabaseAdminConfigured()) {
    upsertStepEntry({ ...input, screenshot_url: input.screenshotUrl });
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
      screenshot_url: input.screenshotUrl,
    },
    { onConflict: "user_id,entry_date" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

/** Removes all step entries for the signed-in caller's own identity. */
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

/** The signed-in caller's own entry for a specific date, if any — used to show "already recorded today" state. */
export async function getStepForUserAndDate(
  userId: string,
  entryDate: string
): Promise<{ steps: number; entry_date: string } | null> {
  if (!isSupabaseAdminConfigured()) {
    const row = getStepEntryForUserAndDate(userId, entryDate);
    return row ? { steps: row.steps, entry_date: row.entry_date } : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("steps")
    .select("steps, entry_date")
    .eq("user_id", userId)
    .eq("entry_date", entryDate)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data ?? null;
}

/** All step rows with entry_date within [startDate, endDate] (inclusive, ISO strings). */
export async function getStepsInRange(startDate: string, endDate: string): Promise<StepsRow[]> {
  if (!isSupabaseConfigured()) {
    return getStepEntriesInRange(startDate, endDate);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("steps")
    .select("name, steps, entry_date, user_id")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate);

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
