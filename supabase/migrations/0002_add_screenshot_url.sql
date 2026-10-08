-- Step Count Give Event: add screenshot support
-- Run this after 0001_init.sql. Adds a column to store the public URL of
-- each participant's uploaded step-count screenshot, plus Storage RLS
-- policies for a public "screenshots" bucket.
--
-- IMPORTANT: before running the storage policy statements below, create the
-- bucket first (Supabase dashboard -> Storage -> New bucket -> name
-- "screenshots" -> Public bucket: ON). The bucket itself cannot be created
-- via SQL, only its policies.

alter table public.steps
  add column if not exists screenshot_url text;

-- Allow anonymous uploads to the "screenshots" bucket (needed since this
-- app has no login — anyone submitting steps uploads via the anon key).
drop policy if exists "Allow public screenshot upload" on storage.objects;
create policy "Allow public screenshot upload"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'screenshots');

-- Allow public read access so screenshot URLs work in <img> tags and links
-- without auth (the bucket should also be marked "Public" in the dashboard,
-- which handles reads via the CDN; this policy additionally covers reads
-- through the Storage API).
drop policy if exists "Allow public screenshot read" on storage.objects;
create policy "Allow public screenshot read"
  on storage.objects for select
  to anon
  using (bucket_id = 'screenshots');
