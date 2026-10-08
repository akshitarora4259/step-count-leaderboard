import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  deleteStepEntriesForName,
  getStepEntriesInRange,
  upsertStepEntry,
} from "@/lib/memoryStore";

/**
 * Shared steps-table storage abstraction, branching on whether Supabase is
 * configured (see lib/supabase.ts `isSupabaseConfigured`). Used by both the
 * Fitbit sync logic and the leaderboard API, so that upsert/delete/range
 * logic lives in one place instead of being duplicated per caller.
 */

export type StepsRow = { name: string; steps: number; entry_date: string };

export async function upsertDailySteps(input: {
  name: string;
  email: string | null;
  steps: number;
  entry_date: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    upsertStepEntry(input);
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("steps")
    .upsert(
      { name: input.name, email: input.email, steps: input.steps, entry_date: input.entry_date },
      { onConflict: "name,entry_date" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

/** Removes all step entries for a participant (used on Fitbit disconnect). */
export async function deleteStepsForName(name: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    deleteStepEntriesForName(name);
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("steps").delete().ilike("name", name);
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
