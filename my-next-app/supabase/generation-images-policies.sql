-- Manual setup only; this file does not run automatically.
-- Create/verify generation-images in the Supabase Storage dashboard:
-- private bucket, file size limit 5242880 bytes,
-- allowed MIME types image/jpeg, image/png, image/webp.
-- Review existing storage.objects policies before applying: broad permissive
-- policies must not grant other users or anonymous clients access to this bucket.
-- Keep the existing bucket-scoped avatar policies unchanged.

begin;

create policy generation_images_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'generation-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy generation_images_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'generation-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy generation_images_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'generation-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

commit;
