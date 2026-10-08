-- Fitbit OAuth connections for the step count give event.
--
-- Stores encrypted Fitbit access/refresh tokens per participant so the app
-- can automatically sync daily step counts via Fitbit's Web API, replacing
-- manual entry / screenshot upload entirely.
--
-- IMPORTANT: this table is intentionally NOT exposed to the public anon
-- key. Row Level Security is enabled with no policies defined below, which
-- means the anon/authenticated roles get zero access to it by default. The
-- app only reads and writes this table from server-side API routes using
-- SUPABASE_SERVICE_ROLE_KEY (never sent to the browser — see README.md).
--
-- Access tokens and refresh tokens are additionally encrypted at the
-- application layer (AES-256-GCM, see lib/crypto.ts) before being written
-- here, so even a leaked database dump doesn't directly expose usable
-- Fitbit tokens.

create extension if not exists pgcrypto;

create table if not exists fitbit_connections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  fitbit_user_id text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  is_mock boolean not null default false,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One Fitbit connection per participant name (case-insensitive), matching
-- the existing `steps` table's (name, entry_date) upsert convention.
create unique index if not exists fitbit_connections_name_idx
  on fitbit_connections (lower(name));

alter table fitbit_connections enable row level security;
-- No policies are added on purpose: only the service_role key (used
-- server-side only, via SUPABASE_SERVICE_ROLE_KEY) can read/write this
-- table. The anon key used by the rest of the app cannot see it at all.
