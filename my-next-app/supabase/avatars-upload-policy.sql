-- Run once in the Supabase SQL Editor.
-- The app uploads a new file for each photo change, so only INSERT is needed.
-- This does not change RLS settings, public.profiles, or the auth.users trigger.
create policy "Users can upload avatars to their own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
