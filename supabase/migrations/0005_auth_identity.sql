-- Replace name-based "identity" with real Supabase Auth (email OTP).
--
-- Previously, both `steps` and `fitbit_connections` were keyed purely by a
-- self-reported `name` field — any client could claim any name via a
-- request body/query param (e.g. POST /api/fitbit/disconnect {name:
-- "someone else"} would delete that person's data). `user_id` is now the
-- real authorization boundary, derived server-side from the caller's
-- verified Supabase Auth session (see lib/identity.ts) — `name` remains a
-- free-text *display* field, never an auth boundary.
--
-- Nullable `user_id` is fine here: there's no real production data yet
-- (pre-launch), so no backfill is needed.

alter table public.steps
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.fitbit_connections
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- Replace the old name-based uniqueness with user_id-scoped uniqueness: a
-- signed-in participant can only have one Fitbit connection / one entry per
-- day, keyed by their verified identity rather than a self-reported display
-- name. (This also fixes a latent limitation where two different real
-- people who happen to share a display name couldn't both join.)
drop index if exists public.fitbit_connections_name_idx;
create unique index if not exists fitbit_connections_user_id_idx
  on public.fitbit_connections (user_id)
  where user_id is not null;

drop index if exists public.steps_name_entry_date_key;
create unique index if not exists steps_user_id_entry_date_key
  on public.steps (user_id, entry_date)
  where user_id is not null;

-- The fitbit_user_id partial unique index from migration 0004 is orthogonal
-- (it prevents the same *physical* Fitbit account from being linked under
-- two different app identities) and is left untouched by this migration.

-- Revoke direct public write access to `steps`: all writes now go through
-- server-side API routes (service-role client) only after verifying the
-- caller's session server-side, so the anon key — embedded in client-side
-- JS and effectively public — no longer needs (or should have) insert/
-- update rights. Public read access is kept so the leaderboard keeps
-- working fully unauthenticated.
drop policy if exists "Allow public insert" on public.steps;
drop policy if exists "Allow public update" on public.steps;
-- "Allow public read" (see 0001_init.sql) is intentionally left in place.
