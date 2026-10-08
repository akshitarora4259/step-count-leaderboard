-- Step Count Give Event: initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) for your project.

create extension if not exists "pgcrypto";

create table if not exists public.steps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  steps integer not null check (steps >= 0 and steps <= 100000),
  entry_date date not null,
  created_at timestamptz not null default now()
);

-- One entry per participant per day: resubmitting the same name + date
-- updates the existing row instead of creating a duplicate.
create unique index if not exists steps_name_entry_date_key
  on public.steps (name, entry_date);

-- Speeds up per-participant / per-day lookups and the leaderboard aggregation.
create index if not exists steps_name_entry_date_idx
  on public.steps (name, entry_date);

-- Row Level Security: this is a casual, no-login internal event, so we allow
-- anonymous read/insert/update via the public anon key. Tighten this if you
-- need stricter access control.
alter table public.steps enable row level security;

drop policy if exists "Allow public read" on public.steps;
create policy "Allow public read"
  on public.steps for select
  to anon
  using (true);

drop policy if exists "Allow public insert" on public.steps;
create policy "Allow public insert"
  on public.steps for insert
  to anon
  with check (true);

drop policy if exists "Allow public update" on public.steps;
create policy "Allow public update"
  on public.steps for update
  to anon
  using (true)
  with check (true);
