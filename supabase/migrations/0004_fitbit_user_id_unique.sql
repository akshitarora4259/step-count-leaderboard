-- Prevent the same real Fitbit account from being linked to two different
-- participant names.
--
-- `fitbit_connections` already has a unique index on lower(name) (one
-- connection per participant), but nothing previously stopped the same
-- `fitbit_user_id` from being reused under a different name — e.g. someone
-- disconnecting and reconnecting under a second name, or two form
-- submissions racing with the same real Fitbit account. The application
-- layer (see lib/fitbitConnections.ts `assertFitbitUserIdAvailable`) checks
-- this up front to produce a friendly error naming the existing owner, but
-- this index is the hard database-level backstop against races/bypasses.
--
-- `fitbit_user_id` is nullable (mock/legacy rows may not have one, and it's
-- not populated until the OAuth callback completes), so the index only
-- applies `where fitbit_user_id is not null` — multiple null rows are fine.
--
-- Run this after 0003_fitbit_connections.sql. Safe to run even if some rows
-- already exist; it will fail loudly (instead of silently) if a duplicate
-- fitbit_user_id already exists in the table, which should be investigated
-- manually before re-running.

create unique index if not exists fitbit_connections_fitbit_user_id_idx
  on fitbit_connections (fitbit_user_id)
  where fitbit_user_id is not null;
