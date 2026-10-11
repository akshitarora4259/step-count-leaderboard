-- Fix "no unique or exclusion constraint matching the ON CONFLICT
-- specification" on POST /api/steps/upload.
--
-- Migration 0005 created `steps_user_id_entry_date_key` as a *partial*
-- unique index (`where user_id is not null`), anticipating legacy rows
-- with a null user_id. In practice, `lib/identity.ts`'s
-- `getCurrentIdentity()` never returns a null userId — every caller of
-- `upsertDailySteps` (lib/steps.ts) already has a verified, non-null
-- user_id — so no row is ever written with a null user_id, and the
-- partial predicate serves no purpose.
--
-- The problem: `lib/steps.ts` upserts with
-- `{ onConflict: "user_id,entry_date" }`, which PostgREST translates to a
-- plain `ON CONFLICT (user_id, entry_date)` clause (no WHERE predicate).
-- Postgres can only use ON CONFLICT inference against a unique
-- index/constraint whose definition exactly matches — a partial index does
-- not qualify unless the INSERT's ON CONFLICT clause repeats the same
-- WHERE predicate, which the Supabase JS client's `.upsert()` has no way to
-- express. Replacing the partial index with a full (non-partial) unique
-- constraint on the same two columns fixes this: a plain unique constraint
-- still permits multiple null `user_id` rows (NULL <> NULL under standard
-- SQL uniqueness semantics), so nothing is lost by dropping the predicate.

drop index if exists public.steps_user_id_entry_date_key;

alter table public.steps
  add constraint steps_user_id_entry_date_key unique (user_id, entry_date);
