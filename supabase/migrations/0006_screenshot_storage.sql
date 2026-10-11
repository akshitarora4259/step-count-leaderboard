-- Private Storage bucket for daily step-count screenshots (OCR source
-- images), replacing the abandoned public "screenshots" bucket from
-- migration 0002 (left untouched/orphaned per the no-destructive-edits
-- policy on prior migrations).
--
-- Unlike 0002's bucket, this one holds files scoped to one person's own
-- upload history, so it's private: only the owning user (by `auth.uid()`)
-- can read/write their own files, matched via the `{user_id}/...` path
-- prefix convention enforced in lib/screenshotStorage.ts.
--
-- Note: all actual uploads/deletes in this app go through the server-side
-- service-role client (see lib/screenshotStorage.ts), which bypasses RLS
-- entirely. These policies are defense-in-depth for any future direct
-- client-side Storage access, not what gates the upload API route itself —
-- that's gated by the verified session identity checked in
-- app/api/steps/upload/route.ts.

insert into storage.buckets (id, name, public)
values ('step-screenshots', 'step-screenshots', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own step screenshots" on storage.objects;
create policy "Users can upload their own step screenshots"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'step-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own step screenshots" on storage.objects;
create policy "Users can update their own step screenshots"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'step-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read their own step screenshots" on storage.objects;
create policy "Users can read their own step screenshots"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'step-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own step screenshots" on storage.objects;
create policy "Users can delete their own step screenshots"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'step-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
