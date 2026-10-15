-- Fix existing projects without changing ownership, role or draft requirements.
-- Inside the vehicles subquery, an unqualified "name" resolves to vehicles.name,
-- not the storage object's path. Qualify the outer storage column explicitly.
begin;
drop policy if exists camotes_upload_own_folder on storage.objects;
create policy camotes_upload_own_folder on storage.objects
for insert to authenticated with check (
  camotes_private.account_active()
  and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  and (
    bucket_id in ('avatars','verification-documents','payment-proofs','handover-photos')
    or (
      bucket_id = 'vehicle-photos'
      and exists (
        select 1 from public.vehicles v
        where v.id::text = (storage.foldername(storage.objects.name))[2]
          and camotes_private.draft_vehicle(v.id)
      )
    )
  )
);
commit;
