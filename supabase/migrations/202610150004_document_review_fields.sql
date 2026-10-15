-- Run after the existing schema and API migration. Safe to reapply.
-- Only the authenticated administrator review RPC can write these new fields.
begin;
alter table public.documents add column if not exists review_details jsonb not null default '{}'::jsonb;

create or replace function camotes_private.review_document_details(document_kind text, details jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare allowed text[]; item record;
begin
  allowed := case document_kind
    when 'or_cr' then array['or_number','cr_number']
    when 'ctpl_insurance' then array['insurer']
    when 'passenger_insurance' then array['insurer','coverage_details']
    when 'business_permit' then array['business_name','issuing_authority']
    when 'dti_sec_registration' then array['business_name','issuing_authority']
    when 'professional_license' then array['profession','issuing_authority']
    when 'pnp_clearance' then array['issuing_authority']
    when 'nbi_clearance' then array['issuing_authority']
    else array[]::text[] end;
  if details is null or jsonb_typeof(details) <> 'object' then raise exception 'Review details must be an object'; end if;
  for item in select key,value from jsonb_each(details) loop
    if not item.key = any(allowed) then raise exception 'Review field does not apply to this document: %',item.key; end if;
    if jsonb_typeof(item.value) <> 'string' or length(item.value #>> '{}') > 2000 then raise exception 'Review fields must be text of at most 2000 characters'; end if;
  end loop;
  if document_kind='dti_sec_registration' and coalesce(details->>'issuing_authority','') <> ''
    and upper(btrim(details->>'issuing_authority')) not in ('DTI','SEC') then raise exception 'Choose DTI or SEC as issuing authority'; end if;
  return details;
end $$;
revoke all on function camotes_private.review_document_details(text,jsonb) from public,anon,authenticated;

do $migration$
declare definition text;
  anchor constant text := 'update public.documents set status=kind,reference_number=';
  replacement constant text := $replacement$
/* document-review-v1 */
   if payload ? 'plate_number' and d.document_type not in ('or_cr','ctpl_insurance','ltfrb_authority','passenger_insurance') then raise exception 'Plate number does not apply to this document'; end if;
   if payload ? 'vehicle_classes' then
     if d.document_type not in ('drivers_license','professional_license') then raise exception 'Vehicle classes apply only to driver licenses'; end if;
     if jsonb_typeof(payload->'vehicle_classes') <> 'array' then raise exception 'Vehicle classes must be an array'; end if;
     if exists(select 1 from jsonb_array_elements_text(payload->'vehicle_classes') c where c not in ('car','suv','van','motorcycle')) then raise exception 'Invalid verified vehicle class'; end if;
   end if;
   if payload ? 'verified_date_of_birth' and d.document_type not in ('government_id','drivers_license','professional_license') then raise exception 'Birth date does not apply to this document'; end if;
   if payload ? 'issued_on' and d.document_type='government_id' then raise exception 'Issue date is not part of the government ID review'; end if;
   if kind='approved' then
     if (payload->>'issued_on')::date > today then raise exception 'Issue date cannot be in the future'; end if;
     if payload ? 'expires_on' and (payload->>'expires_on')::date < today then raise exception 'Document is expired'; end if;
     if payload ? 'expires_on' and payload->>'expires_on' is null and d.document_type not in ('government_id','or_cr','dti_sec_registration') then raise exception 'Current expiry date required by platform policy'; end if;
   end if;
   update public.documents set
    review_details=case when payload ? 'review_details' then camotes_private.review_document_details(d.document_type,payload->'review_details') else review_details end,
    issued_on=case when payload ? 'issued_on' then (payload->>'issued_on')::date else issued_on end,
    status=kind,reference_number=
$replacement$;
begin
  select pg_get_functiondef('public.camotes_mutate(text,jsonb)'::regprocedure) into definition;
  if strpos(definition,'/* document-review-v1 */') > 0 then return; end if;
  if strpos(definition,anchor)=0 then raise exception 'Unrecognized document review RPC. Apply the API migration first or review its deployed definition.'; end if;
  definition := replace(definition,anchor,btrim(replacement,E'\n\r'));
  definition := replace(definition,'reference_number=coalesce(payload->>''reference_number'',reference_number),plate_number=coalesce(payload->>''plate_number'',plate_number),',
    'reference_number=case when payload ? ''reference_number'' then payload->>''reference_number'' else reference_number end,plate_number=case when payload ? ''plate_number'' then payload->>''plate_number'' else plate_number end,');
  -- Explicitly clearing an optional expiry must not silently retain its old value.
  definition := replace(definition,'expires_on=coalesce((payload->>''expires_on'')::date,expires_on),license_kind=',
    'expires_on=case when payload ? ''expires_on'' then (payload->>''expires_on'')::date else expires_on end,license_kind=');
  execute definition;
end $migration$;
commit;
