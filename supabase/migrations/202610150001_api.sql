-- Run AFTER supabase_dbschema.md. Safe to rerun; does not reset user data.
begin;
alter table public.bookings add column if not exists payment_method text not null default 'cash'
  check (payment_method in ('cash','gcash','maya','bank_transfer'));
alter table public.bookings add column if not exists request_fingerprint text;
alter table public.payouts add column if not exists idempotency_key uuid not null default gen_random_uuid();
create unique index if not exists payouts_idempotency_idx on public.payouts(idempotency_key);
create table if not exists camotes_private.api_rate_limits (
 user_id uuid not null, minute timestamptz not null, requests integer not null,
 primary key(user_id,minute)
);
alter table camotes_private.api_rate_limits enable row level security;
revoke all on camotes_private.api_rate_limits from public,anon,authenticated;

-- An owner can explicitly reopen a listing as a draft; the RPC below removes
-- its approval and eligibility before accepting edits. Public clients cannot
-- directly set status/approval columns.
create or replace function camotes_private.validate_vehicle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'UPDATE' and old.status = 'approved' and new.status <> 'draft' and
   (to_jsonb(new)-array['status','updated_at']) is distinct from (to_jsonb(old)-array['status','updated_at']) then
   new.status='pending'; new.with_driver_eligible=false; new.reviewed_at=null; new.reviewed_by=null;
 end if;
 if new.status='approved' then
   if not exists(select 1 from public.user_roles where user_id=new.owner_id and role='owner' and status='active') then raise exception 'Active owner role required'; end if;
   perform camotes_private.require_documents(new.owner_id,new.id,'vehicle_self_drive',camotes_private.today_manila());
   if not exists(select 1 from public.profiles p join auth.users u on u.id=p.auth_user_id where p.id=new.owner_id and p.account_status='active' and u.email_confirmed_at is not null) then raise exception 'Verified owner email required'; end if;
   if not exists(select 1 from public.documents where vehicle_id=new.id and document_type='or_cr' and status='approved' and upper(regexp_replace(plate_number,'\s','','g'))=upper(regexp_replace(new.plate_number,'\s','','g'))) then raise exception 'OR/CR plate must match'; end if;
   if new.business_owned then perform camotes_private.require_documents(new.owner_id,null,'business',camotes_private.today_manila()); end if;
   if new.reviewed_by is null or new.reviewed_at is null then raise exception 'Recorded reviewer required'; end if;
 end if;
 if new.with_driver_eligible then
   perform camotes_private.require_documents(new.owner_id,new.id,'vehicle_chauffeured',camotes_private.today_manila());
   if not exists(select 1 from public.documents where vehicle_id=new.id and document_type='ltfrb_authority' and status='approved' and reference_number=new.ltfrb_case_number and upper(regexp_replace(plate_number,'\s','','g'))=upper(regexp_replace(new.plate_number,'\s','','g')) and expires_on=new.ltfrb_valid_until) then raise exception 'Authority case, plate and expiry must match'; end if;
 end if;
 return new;
end $$;

create or replace function camotes_private.vehicle_json(v public.vehicles) returns jsonb
language sql stable security definer set search_path = '' as $$
 select (to_jsonb(v)-array['plate_number','ltfrb_case_number','ltfrb_valid_until','reviewed_by','rejection_reason'])
 || jsonb_build_object('owner_name',(select full_name from public.profiles where id=v.owner_id),
 'photos',coalesce((select jsonb_agg(storage_path order by position) from public.vehicle_photos where vehicle_id=v.id),'[]'),
 'rating',(select round(avg(rating),1) from public.reviews where vehicle_id=v.id and not hidden),
 'review_count',(select count(*) from public.reviews where vehicle_id=v.id and not hidden));
$$;
create or replace function camotes_private.booking_json(b public.bookings) returns jsonb
language sql stable security definer set search_path = '' as $$
 select to_jsonb(b)||jsonb_build_object('vehicle',camotes_private.vehicle_json(v),
 'pickup_name',coalesce((select name from public.locations where id=b.pickup_location_id),b.pickup_address),
 'reviewed',exists(select 1 from public.reviews where booking_id=b.id and target_type='vehicle'))
 from public.vehicles v where v.id=b.vehicle_id;
$$;

create or replace function public.camotes_read(resource text, params jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid=auth.uid(); result jsonb; target uuid; b public.bookings%rowtype;
 lim integer=least(50,greatest(1,coalesce((params->>'limit')::integer,25)));
 offst integer=greatest(0,coalesce((params->>'offset')::integer,0));
begin
 if resource='settings' then return public.get_public_settings(); end if;
 if resource='locations' then return coalesce((select jsonb_agg(to_jsonb(l) order by name) from public.locations l where active),'[]'); end if;
 if resource='vehicles' then
   return coalesce((select jsonb_agg(camotes_private.vehicle_json(q)) from (
     select v.* from public.vehicles v where camotes_private.visible_vehicle(v.id)
     and (params->>'id' is null or v.id=(params->>'id')::uuid)
     and (params->>'search' is null or v.name ilike '%'||(params->>'search')||'%' or v.pickup_town ilike '%'||(params->>'search')||'%')
     and (params->>'type' is null or v.vehicle_type=params->>'type')
     and (params->>'town' is null or v.pickup_town=params->>'town')
     and (params->>'max_price' is null or v.daily_rate_centavos <= (params->>'max_price')::bigint)
    and (params->>'transmission' is null or v.transmission=params->>'transmission')
    and (params->>'min_seats' is null or v.seats>=(params->>'min_seats')::integer)
     order by v.created_at desc,v.id limit lim offset offst) q),'[]');
 end if;
 if auth.role() is distinct from 'authenticated' or actor is null or not camotes_private.account_active() then raise insufficient_privilege using message='Sign in with an active account'; end if;
 if resource='me' then
   return jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id=actor),
    'roles',coalesce((select jsonb_agg(to_jsonb(r)) from public.user_roles r where user_id=actor),'[]'),
    'favorites',coalesce((select jsonb_agg(vehicle_id) from public.favorites where user_id=actor),'[]'),
    'driver_profile',(select to_jsonb(d) from public.driver_profiles d where user_id=actor));
 end if;
 if resource='owned_vehicles' then
   return coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('photos',coalesce((select jsonb_agg(storage_path order by position) from public.vehicle_photos where vehicle_id=v.id),'[]'))) from public.vehicles v where owner_id=actor and status <> 'deleted'),'[]');
 end if;
 if resource='saved' then return coalesce((select jsonb_agg(camotes_private.vehicle_json(v)) from public.vehicles v join public.favorites f on f.vehicle_id=v.id where f.user_id=actor and camotes_private.visible_vehicle(v.id)),'[]'); end if;
 if resource='bookings' then
   return coalesce((select jsonb_agg(camotes_private.booking_json(q)) from (select * from public.bookings where actor in (renter_id,owner_id,driver_id) and (params->>'mode' is null or case params->>'mode' when 'owner' then owner_id=actor when 'driver' then driver_id=actor when 'renter' then renter_id=actor else false end) and (params->>'status_group' is null or case params->>'status_group' when 'upcoming' then status in ('pending_owner','pending_driver','confirmed') when 'ongoing' then status in ('in_progress','disputed') when 'past' then status='completed' when 'cancelled' then status in ('declined','expired','cancelled_by_renter','cancelled_by_owner','cancelled_by_driver','no_show') else false end) order by created_at desc,id limit lim offset offst) q),'[]');
 end if;
 if resource='booking' then
   target=(params->>'id')::uuid;
   if not camotes_private.booking_participant(target) and not camotes_private.is_admin() then raise insufficient_privilege using message='Booking unavailable'; end if;
   select * into b from public.bookings where id=target;
   if b.id is null then raise no_data_found using message='Booking not found'; end if;
   return camotes_private.booking_json(b)||jsonb_build_object(
    'contacts',coalesce((select jsonb_agg(to_jsonb(c)) from public.get_booking_contacts(target) c),'[]'),
    'payments',case when actor in (b.renter_id,b.owner_id) or camotes_private.is_admin() then coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc) from public.payments p where booking_id=target),'[]') else '[]'::jsonb end,
    'handovers',case when camotes_private.booking_participant(target) or camotes_private.dispute_admin(target) then coalesce((select jsonb_agg(to_jsonb(h)) from public.handovers h where booking_id=target),'[]') else '[]'::jsonb end,
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by created_at) from public.booking_events e where booking_id=target),'[]'),
    'conversation_id',(select id from public.conversations where booking_id=target));
 end if;
 if resource='chat' then
   target=(params->>'id')::uuid;
   if not camotes_private.booking_participant(target) and not camotes_private.dispute_admin(target) then raise insufficient_privilege using message='Conversation unavailable'; end if;
   return jsonb_build_object('conversation_id',(select id from public.conversations where booking_id=target),
    'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id) from
       (select m.* from public.messages m join public.conversations c on c.id=m.conversation_id where c.booking_id=target order by m.created_at desc,m.id desc limit lim offset offst) m),'[]'));
 end if;
 if resource='notifications' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.notifications where user_id=actor order by created_at desc limit lim offset offst) q),'[]'); end if;
 if resource='documents' then return coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc) from public.documents d where user_id=actor),'[]'); end if;
 if resource='availability' then
   if params->>'vehicle_id' is not null then
     target=(params->>'vehicle_id')::uuid;
     if not camotes_private.owns_vehicle(target) then raise insufficient_privilege using message='Not your vehicle'; end if;
     return coalesce((select jsonb_agg(to_jsonb(a)) from public.vehicle_availability a where vehicle_id=target),'[]');
   end if;
   return coalesce((select jsonb_agg(to_jsonb(a)) from public.driver_availability a where driver_id=actor),'[]');
 end if;
 if resource='drivers' then
   if not coalesce((public.get_public_settings()->>'chauffeur_enabled')::boolean,false) then return '[]'; end if;
   return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'avatar_path',p.avatar_path,'daily_fee_centavos',d.daily_fee_centavos,'service_areas',d.service_areas))
    from public.driver_profiles d join public.profiles p on p.id=d.user_id
    join public.user_roles r on r.user_id=d.user_id and r.role='driver' and r.status='active'
    where p.account_status='active' and p.id<>actor and d.verification_status='approved' and d.available_for_hire
    and camotes_private.has_document(p.id,null,'professional_license',coalesce((params->>'through')::date,camotes_private.today_manila()))),'[]');
 end if;
 if resource='earnings' then
   return jsonb_build_object('owner_gross_centavos',coalesce((select sum(rental_days*vehicle_rate_centavos) from public.bookings where owner_id=actor and status='completed'),0),
    'driver_gross_centavos',coalesce((select sum(rental_days*driver_rate_centavos) from public.bookings where driver_id=actor and status='completed'),0),
    'payouts',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc) from public.payouts p where provider_id=actor),'[]'));
 end if;
 if resource='admin' then
   if not camotes_private.is_admin() then raise insufficient_privilege using message='Admin role and MFA required'; end if;
   -- Deliberately exclude conversations/messages: those require assigned disputes.
   case coalesce(params->>'section','overview')
    when 'overview' then return jsonb_build_object('users',(select count(*) from public.profiles),'vehicles',(select count(*) from public.vehicles where status='approved'),'bookings',(select count(*) from public.bookings),'pending_documents',(select count(*) from public.documents where status='pending'));
    when 'users' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.profiles order by created_at desc limit lim offset offst) q),'[]');
    when 'roles' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.user_roles order by created_at desc limit lim offset offst) q),'[]');
    when 'documents' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.documents order by created_at desc limit lim offset offst) q),'[]');
    when 'vehicles' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.vehicles order by created_at desc limit lim offset offst) q),'[]');
    when 'bookings' then return coalesce((select jsonb_agg(camotes_private.booking_json(q)) from (select * from public.bookings order by created_at desc limit lim offset offst) q),'[]');
    when 'payments' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.payments order by created_at desc limit lim offset offst) q),'[]');
    when 'disputes' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.reports_disputes order by created_at desc limit lim offset offst) q),'[]');
    when 'reviews' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.reviews order by created_at desc limit lim offset offst) q),'[]');
    when 'audit' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.audit_logs order by created_at desc limit lim offset offst) q),'[]');
    when 'payouts' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.payouts order by created_at desc limit lim offset offst) q),'[]');
    when 'settings' then return (select to_jsonb(s) from public.platform_settings s where id);
    else raise exception 'Unknown admin section';
   end case;
 end if;
 raise exception 'Unknown resource';
end $$;

create or replace function camotes_private.owns_upload(bucket text,path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select split_part(path,'/',1)=auth.uid()::text and exists(select 1 from storage.objects where bucket_id=bucket and name=path);
$$;
create or replace function camotes_private.confirm_if_ready(booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; received numeric;
begin
 select * into b from public.bookings where id=booking for update;
 select coalesce(sum(amount_centavos),0) into received from public.payments where booking_id=b.id and status='confirmed' and event_type in ('advance','rental');
 if b.status in ('pending_owner','pending_driver') and b.owner_accepted_at is not null
   and (b.driver_id is null or b.driver_accepted_at is not null) and received>=b.advance_required_centavos then
   update public.bookings set status='confirmed',driver_trip_status=case when driver_id is null then 'not_applicable' else 'accepted' end where id=b.id;
 end if;
end $$;

create or replace function public.camotes_mutate(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid=auth.uid(); target uuid; b public.bookings%rowtype; v public.vehicles%rowtype;
 p public.payments%rowtype; payout public.payouts%rowtype; d public.documents%rowtype; settings public.platform_settings%rowtype;
 result jsonb; total numeric; fee bigint; received numeric; amount bigint; kind text; role_name text;
 starts timestamptz; ends timestamptz; n integer; entry jsonb; path text; pickup_town_value text; handover_phase text; today date=camotes_private.today_manila();
begin
 if auth.role() is distinct from 'authenticated' or actor is null or not camotes_private.account_active() then raise insufficient_privilege using message='Sign in with an active account'; end if;
 if jsonb_typeof(payload)<>'object' then raise exception 'JSON object required'; end if;
 delete from camotes_private.api_rate_limits where user_id=actor and minute<date_trunc('minute',now())-interval '1 hour';
 insert into camotes_private.api_rate_limits values(actor,date_trunc('minute',now()),1)
 on conflict(user_id,minute) do update set requests=camotes_private.api_rate_limits.requests+1 returning requests into n;
 if n>120 then raise exception using message='Too many changes; try again in a minute',errcode='P0429'; end if;
 if action like 'admin.%' and not camotes_private.is_admin() then raise insufficient_privilege using message='Admin role and MFA required'; end if;
 if action='profile.update' then
   update public.profiles set full_name=coalesce(payload->>'full_name',full_name),phone=coalesce(payload->>'phone',phone),
    submitted_date_of_birth=coalesce((payload->>'submitted_date_of_birth')::date,submitted_date_of_birth),
    terms_accepted_at=case when (payload->>'accept_terms')::boolean then coalesce(terms_accepted_at,now()) else terms_accepted_at end,
    privacy_accepted_at=case when (payload->>'accept_terms')::boolean then coalesce(privacy_accepted_at,now()) else privacy_accepted_at end,
    notification_preferences=case when payload ? 'notification_preferences' then jsonb_build_object('bookings',coalesce((payload->'notification_preferences'->>'bookings')::boolean,true),'messages',coalesce((payload->'notification_preferences'->>'messages')::boolean,true),'documents',coalesce((payload->'notification_preferences'->>'documents')::boolean,true)) else notification_preferences end
    where id=actor returning to_jsonb(profiles) into result; return result;
 end if;
 if action='profile.mode' then
   role_name=payload->>'mode'; if not camotes_private.has_role(role_name) or role_name not in ('renter','owner','driver') then raise insufficient_privilege using message='Verified role required'; end if;
   update public.profiles set preferred_mode=role_name where id=actor; return jsonb_build_object('mode',role_name);
 end if;
 if action='profile.delete_request' then
   if exists(select 1 from public.bookings where actor in (renter_id,owner_id,driver_id) and status in ('confirmed','in_progress','disputed')) then raise exception 'Resolve active bookings/disputes before requesting deletion'; end if;
   update public.profiles set deletion_requested_at=now() where id=actor;
   insert into public.audit_logs(actor_id,database_role,table_name,record_id,action) values(actor,'authenticated','profiles',actor::text,'deletion_requested');
   return jsonb_build_object('requested',true);
 end if;
 if action='roles.request' then
   role_name=payload->>'role'; if role_name not in ('owner','driver') or role_name is null then raise exception 'Owner or driver role required'; end if;
   insert into public.user_roles(user_id,role) values(actor,role_name) on conflict(user_id,role) do update set status='pending',verified_by=null,verified_at=null,rejection_reason=null where user_roles.status='rejected';
   if role_name='driver' then insert into public.driver_profiles(user_id) values(actor) on conflict do nothing; end if;
   return (select to_jsonb(r) from public.user_roles r where user_id=actor and role=role_name);
 end if;
 if action='favorite.set' then
   target=(payload->>'vehicle_id')::uuid;
   if (payload->>'saved')::boolean then
     if not camotes_private.visible_vehicle(target) then raise exception 'Vehicle unavailable'; end if;
     insert into public.favorites values(actor,target,now()) on conflict do nothing;
   else delete from public.favorites where user_id=actor and vehicle_id=target; end if;
   return jsonb_build_object('saved',(payload->>'saved')::boolean);
 end if;
 if action='driver.update' then
   if not exists(select 1 from public.user_roles where user_id=actor and role='driver' and status in ('pending','active')) then raise insufficient_privilege using message='Request a driver role first'; end if;
   if payload ? 'service_areas' and (jsonb_array_length(payload->'service_areas')>4 or exists(select 1 from jsonb_array_elements_text(payload->'service_areas') x where x not in ('San Francisco','Poro','Tudela','Pilar'))) then raise exception 'Choose supported Camotes service areas'; end if;
   if payload ? 'languages' and (jsonb_array_length(payload->'languages')>10 or exists(select 1 from jsonb_array_elements_text(payload->'languages') x where char_length(x)>40)) then raise exception 'Too many languages or language name too long'; end if;
   update public.driver_profiles set daily_fee_centavos=coalesce((payload->>'daily_fee_centavos')::bigint,daily_fee_centavos),available_for_hire=coalesce((payload->>'available_for_hire')::boolean,available_for_hire),
    service_areas=case when payload ? 'service_areas' then array(select jsonb_array_elements_text(payload->'service_areas')) else service_areas end,
    languages=case when payload ? 'languages' then array(select jsonb_array_elements_text(payload->'languages')) else languages end where user_id=actor returning to_jsonb(driver_profiles) into result; return result;
 end if;
 if action='vehicle.save' then
   if not camotes_private.has_role('owner') then raise insufficient_privilege using message='Verified owner role required'; end if;
   if coalesce((payload->>'advance_required_centavos')::bigint,0) > (payload->>'daily_rate_centavos')::bigint*coalesce((payload->>'min_rental_days')::integer,1) then raise exception 'Advance cannot exceed the minimum rental vehicle charge'; end if;
   target=coalesce((payload->>'id')::uuid,gen_random_uuid());
   select * into v from public.vehicles where id=target for update;
   if v.id is not null and v.owner_id<>actor then raise insufficient_privilege using message='Not your vehicle'; end if;
   if exists(select 1 from public.bookings where vehicle_id=target and status in ('confirmed','in_progress','disputed')) then raise exception 'Finish committed rentals before revising a listing'; end if;
   if v.id is not null then update public.vehicles set status='draft',with_driver_eligible=false,reviewed_by=null,reviewed_at=null where id=target; end if;
   insert into public.vehicles(id,owner_id,name,vehicle_type,make,model,year,plate_number,seats,transmission,fuel_type,pickup_town,daily_rate_centavos,deposit_centavos,rules,service_type,business_owned,ltfrb_case_number,ltfrb_valid_until,advance_required_centavos,min_rental_days,max_rental_days,minimum_renter_age)
    values(target,actor,payload->>'name',payload->>'vehicle_type',payload->>'make',payload->>'model',(payload->>'year')::integer,payload->>'plate_number',(payload->>'seats')::integer,payload->>'transmission',payload->>'fuel_type',payload->>'pickup_town',(payload->>'daily_rate_centavos')::bigint,coalesce((payload->>'deposit_centavos')::bigint,0),coalesce(payload->>'rules',''),coalesce(payload->>'service_type','self_drive'),coalesce((payload->>'business_owned')::boolean,false),payload->>'ltfrb_case_number',(payload->>'ltfrb_valid_until')::date,coalesce((payload->>'advance_required_centavos')::bigint,0),coalesce((payload->>'min_rental_days')::integer,1),coalesce((payload->>'max_rental_days')::integer,30),coalesce((payload->>'minimum_renter_age')::integer,18))
    on conflict(id) do update set name=excluded.name,vehicle_type=excluded.vehicle_type,make=excluded.make,model=excluded.model,year=excluded.year,plate_number=excluded.plate_number,seats=excluded.seats,transmission=excluded.transmission,fuel_type=excluded.fuel_type,pickup_town=excluded.pickup_town,daily_rate_centavos=excluded.daily_rate_centavos,deposit_centavos=excluded.deposit_centavos,rules=excluded.rules,service_type=excluded.service_type,business_owned=excluded.business_owned,ltfrb_case_number=excluded.ltfrb_case_number,ltfrb_valid_until=excluded.ltfrb_valid_until,advance_required_centavos=excluded.advance_required_centavos,min_rental_days=excluded.min_rental_days,max_rental_days=excluded.max_rental_days,minimum_renter_age=excluded.minimum_renter_age;
   return (select to_jsonb(q) from public.vehicles q where id=target);
 end if;
 if action in ('vehicle.photo','vehicle.submit','vehicle.deactivate','vehicle.delete') then
   target=(payload->>'id')::uuid;
   select * into v from public.vehicles where id=target for update;
   if v.id is null or v.owner_id<>actor or not camotes_private.has_role('owner') then raise insufficient_privilege using message='Not your vehicle'; end if;
   if action='vehicle.photo' then
     path=payload->>'path';
     if v.status<>'draft' or not camotes_private.owns_upload('vehicle-photos',path) or split_part(path,'/',2)<>target::text then raise exception 'Upload a real photo to your draft vehicle folder first'; end if;
     insert into public.vehicle_photos(vehicle_id,storage_path,position) values(target,path,coalesce((select max(position)+1 from public.vehicle_photos where vehicle_id=target),0));
   elsif action='vehicle.submit' then
     if v.status<>'draft' or not exists(select 1 from public.vehicle_photos where vehicle_id=target) then raise exception 'Draft with at least one photo required'; end if;
     update public.vehicles set status='pending' where id=target;
   else
     if exists(select 1 from public.bookings where vehicle_id=target and status in ('confirmed','in_progress','disputed')) then raise exception 'Vehicle has committed bookings'; end if;
     update public.vehicles set status=case when action='vehicle.delete' then 'deleted' else 'inactive' end where id=target;
   end if;
   return jsonb_build_object('id',target);
 end if;
 if action='document.submit' then
   path=payload->>'storage_path'; target=(payload->>'vehicle_id')::uuid;
   if not camotes_private.owns_upload('verification-documents',path) or (target is not null and not camotes_private.owns_vehicle(target)) then raise insufficient_privilege using message='Upload your own document first'; end if;
   if not coalesce((payload->>'consent')::boolean,false) then raise exception 'Document processing consent required'; end if;
   insert into public.documents(user_id,vehicle_id,document_type,storage_path,reference_number,plate_number,issued_on,expires_on,license_kind,consent_given_at)
    values(actor,target,payload->>'document_type',path,payload->>'reference_number',payload->>'plate_number',(payload->>'issued_on')::date,(payload->>'expires_on')::date,payload->>'license_kind',now()) returning to_jsonb(documents) into result; return result;
 end if;
 if action='availability.save' then
   target=(payload->>'vehicle_id')::uuid; starts=(payload->>'month')::date::timestamp at time zone 'Asia/Manila'; ends=((starts at time zone 'Asia/Manila')+interval '1 month') at time zone 'Asia/Manila';
   if starts is null or (starts at time zone 'Asia/Manila')::date<>date_trunc('month',starts at time zone 'Asia/Manila')::date then raise exception 'Month must be its first day'; end if;
   if target is not null then
     if not camotes_private.has_role('owner') or not camotes_private.owns_vehicle(target) then raise insufficient_privilege using message='Not your vehicle'; end if;
     perform 1 from public.vehicles where id=target for update;
     delete from public.vehicle_availability where vehicle_id=target and starts_at>=starts and starts_at<ends;
   else
     if not camotes_private.has_role('driver') then raise insufficient_privilege using message='Verified driver role required'; end if;
     perform 1 from public.driver_profiles where user_id=actor for update;
     delete from public.driver_availability where driver_id=actor and starts_at>=starts and starts_at<ends;
   end if;
   for entry in select value from jsonb_array_elements(payload->'days') loop
     if (entry#>>'{}')::date< (starts at time zone 'Asia/Manila')::date or (entry#>>'{}')::date >= (ends at time zone 'Asia/Manila')::date then raise exception 'Blocked date outside selected month'; end if;
     if target is not null then insert into public.vehicle_availability(vehicle_id,starts_at,ends_at,reason) values(target,(entry#>>'{}')::date::timestamp at time zone 'Asia/Manila',((entry#>>'{}')::date+1)::timestamp at time zone 'Asia/Manila',coalesce(payload->>'reason','unavailable'));
     else insert into public.driver_availability(driver_id,starts_at,ends_at,reason) values(actor,(entry#>>'{}')::date::timestamp at time zone 'Asia/Manila',((entry#>>'{}')::date+1)::timestamp at time zone 'Asia/Manila',coalesce(payload->>'reason','unavailable')); end if;
   end loop;
   return jsonb_build_object('saved',true);
 end if;
 if action in ('booking.quote','booking.request') then
   if action='booking.request' then
     target=(payload->>'request_id')::uuid; if target is null then raise exception 'Request UUID required'; end if;
     perform pg_advisory_xact_lock(hashtextextended(target::text,0));
     select * into b from public.bookings where id=target;
     if b.id is not null then
       if b.renter_id<>actor or b.request_fingerprint is distinct from md5(payload::text) then raise exception 'Request key already used with different content'; end if;
       return camotes_private.booking_json(b);
     end if;
   end if;
   select * into v from public.vehicles where id=(payload->>'vehicle_id')::uuid for share;
   if v.id is null or not camotes_private.visible_vehicle(v.id) or actor=v.owner_id then raise exception 'Choose an available vehicle from another owner'; end if;
   starts=(payload->>'starts_at')::timestamptz; ends=(payload->>'ends_at')::timestamptz;
   if starts is null or ends is null or starts<=now() or ends<=starts then raise exception 'Valid future dates required'; end if;
   pickup_town_value=payload->>'pickup_town';
   if payload->>'pickup_location_id' is not null then
     select town into pickup_town_value from public.locations where id=(payload->>'pickup_location_id')::uuid and active;
     if pickup_town_value is null then raise exception 'Choose an active pickup location'; end if;
   end if;
   if payload->>'return_location_id' is not null and not exists(select 1 from public.locations where id=(payload->>'return_location_id')::uuid and active) then raise exception 'Choose an active return location'; end if;
   n=ceil(extract(epoch from (ends-starts))/86400.0)::integer;
   if n<v.min_rental_days or n>v.max_rental_days then raise exception 'Rental length outside listing limits'; end if;
   if exists(select 1 from public.bookings where vehicle_id=v.id and status in ('confirmed','in_progress','disputed') and rental_period && tstzrange(starts,ends,'[)')) then raise exception 'Vehicle already reserved for those dates'; end if;
   select * into settings from public.platform_settings where id;
   amount=0;
   if payload->>'driver_id' is not null then
     if not coalesce((public.get_public_settings()->>'chauffeur_enabled')::boolean,false) or not v.with_driver_eligible then raise exception 'Chauffeured service unavailable'; end if;
     select daily_fee_centavos into amount from public.driver_profiles where user_id=(payload->>'driver_id')::uuid and available_for_hire and verification_status='approved';
     if amount is null then raise exception 'Driver unavailable'; end if;
     if exists(select 1 from public.bookings where driver_id=(payload->>'driver_id')::uuid and status in ('confirmed','in_progress','disputed') and rental_period && tstzrange(starts,ends,'[)')) then raise exception 'Driver already reserved for those dates'; end if;
   end if;
   total=n::numeric*(v.daily_rate_centavos+amount); fee=round(total*settings.service_fee_bps/10000.0)::bigint;
   result=jsonb_build_object('rental_days',n,'vehicle_centavos',n*v.daily_rate_centavos,'driver_centavos',n*amount,'service_fee_centavos',fee,'total_centavos',total+fee,'deposit_centavos',v.deposit_centavos);
   if action='booking.quote' then return result; end if;
   if not coalesce((payload->>'accept_terms')::boolean,false) then raise exception 'Accept the rental terms'; end if;
   target=(payload->>'request_id')::uuid; if target is null then raise exception 'Request UUID required'; end if;
   -- Same actor/key/content returns the original request; key reuse cannot leak another booking.
   perform pg_advisory_xact_lock(hashtextextended(target::text,0));
   select * into b from public.bookings where id=target;
   if b.id is not null then
     if b.renter_id<>actor or b.vehicle_id<>v.id or b.starts_at<>starts or b.ends_at<>ends or b.driver_id is distinct from (payload->>'driver_id')::uuid then raise exception 'Request key already used'; end if;
     return camotes_private.booking_json(b);
   end if;
   insert into public.bookings(id,renter_id,vehicle_id,service_type,driver_id,starts_at,ends_at,pickup_location_id,return_location_id,pickup_address,return_address,pickup_town,payment_method,request_fingerprint)
    values(target,actor,v.id,case when payload->>'driver_id' is null then 'self_drive' else 'chauffeured' end,(payload->>'driver_id')::uuid,starts,ends,(payload->>'pickup_location_id')::uuid,(payload->>'return_location_id')::uuid,payload->>'pickup_address',payload->>'return_address',pickup_town_value,coalesce(payload->>'payment_method','cash'),md5(payload::text)) returning * into b;
   if (payload->>'expected_total_centavos')::bigint is distinct from b.total_centavos then raise exception 'Price changed; review a new quote before requesting'; end if;
   for entry in select value from jsonb_array_elements(coalesce(payload->'authorized_driver_ids','[]')) loop
     insert into public.booking_authorized_drivers(booking_id,user_id) values(b.id,(entry#>>'{}')::uuid);
   end loop;
   insert into public.notifications(user_id,mode,kind,title,body,booking_id) values(b.owner_id,'owner','booking_request','New rental request','Open bookings to respond.',b.id);
   return camotes_private.booking_json(b);
 end if;
 if action in ('booking.accept','booking.decline','booking.cancel','booking.start','booking.complete','booking.en_route','handover.save') then
   target=(payload->>'id')::uuid;
   select * into b from public.bookings where id=target for update;
   if b.id is null or not camotes_private.booking_participant(target) then raise insufficient_privilege using message='Booking unavailable'; end if;
   if action='booking.accept' then
     if (actor=b.owner_id and b.owner_accepted_at is not null and (actor is distinct from b.driver_id or b.driver_accepted_at is not null)) or (actor=b.driver_id and b.driver_accepted_at is not null) then return camotes_private.booking_json(b); end if;
     if b.status not in ('pending_owner','pending_driver') or b.response_due_at<=now() then raise exception 'Request no longer open'; end if;
     if actor=b.owner_id and b.owner_accepted_at is null and camotes_private.has_role('owner') then update public.bookings set owner_accepted_at=now(),status=case when driver_id is null then 'pending_owner' else 'pending_driver' end,response_due_at=now()+make_interval(hours=>(select response_window_hours from public.platform_settings where id)) where id=target;
     elsif actor=b.driver_id and b.owner_accepted_at is not null and camotes_private.has_role('driver') then update public.bookings set driver_accepted_at=now(),driver_trip_status='accepted' where id=target;
     else raise insufficient_privilege using message='Only the requested provider can accept'; end if;
     perform camotes_private.confirm_if_ready(target);
   elsif action in ('booking.decline','booking.cancel') then
     if action='booking.decline' and (actor=b.renter_id or b.status not in ('pending_owner','pending_driver')) then raise insufficient_privilege using message='Only a pending provider request can be declined'; end if;
     if action='booking.cancel' and b.status not in ('pending_owner','pending_driver','confirmed') then raise exception 'Booking cannot be cancelled'; end if;
     if nullif(btrim(payload->>'reason'),'') is null then raise exception 'Cancellation/decline reason required'; end if;
     kind=case when action='booking.decline' then 'declined' when actor=b.renter_id then 'cancelled_by_renter' when actor=b.owner_id then 'cancelled_by_owner' else 'cancelled_by_driver' end;
     update public.bookings set status=kind,driver_trip_status=case when driver_id is null then 'not_applicable' else 'pending' end,cancelled_by=actor,cancellation_reason=payload->>'reason' where id=target;
     if actor<>b.renter_id or b.starts_at-now()>=make_interval(hours=>b.cancellation_free_hours) then
       select greatest(0,coalesce(sum(case when event_type in ('rental','advance') then amount_centavos when event_type='refund' then -amount_centavos else 0 end),0)) into received from public.payments where booking_id=target and status='confirmed';
       if received>0 then insert into public.booking_events(booking_id,actor_id,event_type,new_values,reason) values(target,actor,'refund_due',jsonb_build_object('amount_centavos',received),'Manual refund required; no funds transferred'); end if;
     end if;
   elsif action='handover.save' then
     if actor<>b.owner_id or not camotes_private.has_role('owner') then raise insufficient_privilege using message='Vehicle owner records handovers'; end if;
     handover_phase=payload->>'phase'; if not ((handover_phase='pickup' and b.status='confirmed') or (handover_phase='return' and b.status='in_progress')) then raise exception 'Wrong handover phase'; end if;
     for path in select jsonb_array_elements_text(payload->'photo_paths') loop
       if not camotes_private.owns_upload('handover-photos',path) then raise exception 'Upload your condition photos first'; end if;
     end loop;
     insert into public.handovers(booking_id,phase,recorded_by,notes,photo_paths) values(target,handover_phase,actor,coalesce(payload->>'notes',''),array(select jsonb_array_elements_text(payload->'photo_paths'))) on conflict on constraint handovers_booking_id_phase_key do nothing;
   elsif action='booking.en_route' then
     if actor is distinct from b.driver_id or not camotes_private.has_role('driver') then raise insufficient_privilege using message='Assigned driver required'; end if;
     update public.bookings set driver_trip_status='en_route' where id=target;
   else
     if actor=b.renter_id or not ((actor=b.owner_id and camotes_private.has_role('owner')) or (actor=b.driver_id and camotes_private.has_role('driver'))) then raise insufficient_privilege using message='Assigned provider required'; end if;
     handover_phase=case when action='booking.start' then 'pickup' else 'return' end;
     if not exists(select 1 from public.handovers where booking_id=target and handovers.phase=handover_phase) then raise exception 'Owner must record the condition handover first'; end if;
     update public.bookings set status=case when action='booking.start' then 'in_progress' else 'completed' end,driver_trip_status=case when driver_id is null then 'not_applicable' when action='booking.start' then 'started' else 'completed' end where id=target;
   end if;
   insert into public.notifications(user_id,mode,kind,title,body,booking_id) values(b.renter_id,'renter','booking_update','Your booking has an update','Open your trip for details.',target);
   return (select camotes_private.booking_json(q) from public.bookings q where id=target);
 end if;
 if action='payment.submit' then
   target=(payload->>'booking_id')::uuid; select * into b from public.bookings where id=target for update;
   if b.id is null or actor not in (b.renter_id,b.owner_id) or b.owner_accepted_at is null or b.status not in ('pending_owner','pending_driver','confirmed','in_progress') then raise insufficient_privilege using message='Accepted renter/owner booking required'; end if;
   kind=coalesce(payload->>'event_type','rental');
   if kind not in ('rental','advance','deposit_collection') then raise exception 'Invalid payment event'; end if;
   select * into p from public.payments where idempotency_key=(payload->>'request_id')::uuid;
   if p.id is not null then
     if p.submitted_by<>actor or p.booking_id<>target or p.event_type<>kind or p.method is distinct from payload->>'method' or p.reference_number is distinct from payload->>'reference_number' or p.proof_path is distinct from payload->>'proof_path' then raise exception 'Payment key already used with different content'; end if;
     return to_jsonb(p);
   end if;
   select coalesce(sum(amount_centavos),0) into received from public.payments where booking_id=target and status='confirmed' and (case when kind='deposit_collection' then event_type='deposit_collection' else event_type in ('rental','advance') end);
   amount=case when kind='deposit_collection' then b.deposit_centavos-received when kind='advance' then least(b.advance_required_centavos-received,b.total_centavos-received) else b.total_centavos-received end;
   if amount<=0 then raise exception 'Nothing remains due for this payment'; end if;
   path=payload->>'proof_path'; if path is not null and not camotes_private.owns_upload('payment-proofs',path) then raise exception 'Upload your own proof first'; end if;
   if payload->>'method'<>'cash' and nullif(btrim(payload->>'reference_number'),'') is null then raise exception 'Payment reference required'; end if;
   insert into public.payments(booking_id,submitted_by,event_type,amount_centavos,method,reference_number,proof_path,idempotency_key)
    values(target,actor,kind,amount,payload->>'method',payload->>'reference_number',path,(payload->>'request_id')::uuid) returning * into p;
   if kind<>'deposit_collection' then update public.bookings set payment_status='pending_verification' where id=target; end if;
   return to_jsonb(p);
 end if;
 if action in ('payment.confirm','payment.reject','admin.payment.confirm') then
   select * into p from public.payments where id=(payload->>'id')::uuid;
   select * into b from public.bookings where id=p.booking_id for update;
   if p.id is null or not ((actor=b.owner_id and camotes_private.has_role('owner')) or camotes_private.is_admin()) then raise insufficient_privilege using message='Owner or MFA admin required'; end if;
   select * into p from public.payments where id=p.id for update;
   if p.status<>'pending_verification' then return to_jsonb(p); end if;
   if action='payment.reject' then update public.payments set status='rejected',notes=payload->>'reason' where id=p.id;
   else
     select coalesce(sum(amount_centavos),0) into received from public.payments where booking_id=b.id and status='confirmed' and (case when p.event_type='deposit_collection' then event_type='deposit_collection' else event_type in ('rental','advance') end);
     if received+p.amount_centavos>(case when p.event_type='deposit_collection' then b.deposit_centavos else b.total_centavos end) then raise exception 'Payment exceeds remaining amount'; end if;
     update public.payments set status='confirmed',confirmed_by=actor,confirmed_at=now() where id=p.id;
     if p.event_type='deposit_collection' then update public.bookings set deposit_status='held' where id=b.id; end if;
   end if;
   select coalesce(sum(amount_centavos),0) into received from public.payments where booking_id=b.id and status='confirmed' and event_type in ('rental','advance');
   update public.bookings set payment_status=case when received>=total_centavos then 'paid' when exists(select 1 from public.payments where booking_id=b.id and status='pending_verification' and event_type in ('rental','advance')) then 'pending_verification' else 'unpaid' end where id=b.id;
   perform camotes_private.confirm_if_ready(b.id);
   return (select to_jsonb(q) from public.payments q where id=p.id);
 end if;
 if action='payment.settle' then
   target=(payload->>'booking_id')::uuid; select * into b from public.bookings where id=target for update;
   if b.id is null or not ((actor=b.owner_id and camotes_private.has_role('owner')) or camotes_private.is_admin()) then raise insufficient_privilege using message='Owner or MFA admin required'; end if;
   kind=payload->>'event_type'; amount=(payload->>'amount_centavos')::bigint;
   if kind not in ('refund','deposit_return','deposit_withholding') or kind is null or amount is null or amount<=0 then raise exception 'Valid settlement amount/event required'; end if;
   if nullif(btrim(payload->>'reason'),'') is null then raise exception 'Settlement reason required'; end if;
   if payload->>'method'<>'cash' and nullif(btrim(payload->>'reference_number'),'') is null then raise exception 'Transfer reference required'; end if;
   select * into p from public.payments where idempotency_key=(payload->>'request_id')::uuid;
   if p.id is not null then if p.booking_id<>target or p.submitted_by<>actor or p.event_type<>kind or p.amount_centavos<>amount then raise exception 'Settlement key already used'; end if; return to_jsonb(p); end if;
   select coalesce(sum(case when kind='refund' then case when event_type in ('rental','advance') then amount_centavos when event_type='refund' then -amount_centavos else 0 end else case when event_type='deposit_collection' then amount_centavos when event_type in ('deposit_return','deposit_withholding') then -amount_centavos else 0 end end),0) into received from public.payments where booking_id=target and status='confirmed';
   if amount>received then raise exception 'Settlement exceeds confirmed available funds'; end if;
   if kind='deposit_withholding' and not exists(select 1 from public.handovers where booking_id=target and handovers.phase='return') then raise exception 'Return evidence required before withholding'; end if;
   insert into public.payments(booking_id,submitted_by,event_type,amount_centavos,method,reference_number,status,confirmed_by,confirmed_at,idempotency_key,notes)
    values(target,actor,kind,amount,payload->>'method',payload->>'reference_number','confirmed',actor,now(),(payload->>'request_id')::uuid,payload->>'reason') returning * into p;
   if kind='refund' then
     select coalesce(sum(amount_centavos),0) into received from public.payments where booking_id=target and status='confirmed' and event_type='refund';
     update public.bookings set payment_status=case when received >= (select coalesce(sum(amount_centavos),0) from public.payments where booking_id=target and status='confirmed' and event_type in ('rental','advance')) then 'refunded' else 'partially_refunded' end where id=target;
   else
     select coalesce(sum(amount_centavos),0) into received from public.payments where booking_id=target and status='confirmed' and event_type='deposit_withholding';
     update public.bookings set deposit_status=case when received >= (select coalesce(sum(amount_centavos),0) from public.payments where booking_id=target and status='confirmed' and event_type='deposit_collection') then 'withheld' when received>0 then 'partially_withheld' when (select coalesce(sum(amount_centavos),0) from public.payments where booking_id=target and status='confirmed' and event_type='deposit_return') >= (select coalesce(sum(amount_centavos),0) from public.payments where booking_id=target and status='confirmed' and event_type='deposit_collection') then 'returned' else 'held' end where id=target;
   end if;
   return to_jsonb(p);
 end if;
 if action='message.send' then
   target=(payload->>'booking_id')::uuid;
   select id into target from public.conversations where booking_id=target;
   if not camotes_private.can_message(target) then raise insufficient_privilege using message='Booking participant required; blocked users cannot message'; end if;
   insert into public.messages(conversation_id,sender_id,body,client_message_id) values(target,actor,payload->>'body',(payload->>'request_id')::uuid) on conflict(sender_id,client_message_id) do nothing;
   return (select to_jsonb(m) from public.messages m where sender_id=actor and client_message_id=(payload->>'request_id')::uuid and conversation_id=target);
 end if;
 if action='notification.read' then update public.notifications set read_at=now() where user_id=actor and (payload->>'id' is null or id=(payload->>'id')::uuid); return '{"saved":true}'; end if;
 if action='review.submit' then
   target=(payload->>'booking_id')::uuid; select * into b from public.bookings where id=target;
   if b.renter_id is distinct from actor then raise insufficient_privilege using message='Your booking required'; end if;
   kind=coalesce(payload->>'target_type','vehicle');
   insert into public.reviews(booking_id,reviewer_id,target_type,vehicle_id,driver_id,rating,comment) values(target,actor,kind,case when kind='vehicle' then b.vehicle_id end,case when kind='driver' then b.driver_id end,(payload->>'rating')::integer,payload->>'comment') returning to_jsonb(reviews) into result; return result;
 end if;
 if action='block.set' then
   target=(payload->>'user_id')::uuid;
   if (payload->>'blocked')::boolean then insert into public.user_blocks(blocker_id,blocked_id) values(actor,target) on conflict do nothing; else delete from public.user_blocks where blocker_id=actor and blocked_id=target; end if;
   return '{"saved":true}';
 end if;
 if action='report.submit' then
   target=(payload->>'booking_id')::uuid;
   if target is not null and not camotes_private.booking_participant(target) then raise insufficient_privilege using message='Your booking required'; end if;
   insert into public.reports_disputes(reporter_id,booking_id,category,description) values(actor,target,coalesce(payload->>'category','other'),payload->>'description') returning to_jsonb(reports_disputes) into result; return result;
 end if;
 if action='admin.document.review' then
   target=(payload->>'id')::uuid; select * into d from public.documents where id=target for update;
   if d.id is null then raise no_data_found using message='Document not found'; end if;
   kind=payload->>'decision'; if kind not in ('approved','rejected') or kind is null then raise exception 'Approval decision required'; end if;
   if kind='approved' then
     if not exists(select 1 from storage.objects where bucket_id='verification-documents' and name=d.storage_path) then raise exception 'Uploaded evidence is missing'; end if;
     if d.document_type not in ('government_id','or_cr','dti_sec_registration') and coalesce((payload->>'expires_on')::date,d.expires_on,today-1)<today then raise exception 'Current expiry date required'; end if;
     if d.document_type='professional_license' and payload->>'license_kind' is distinct from 'professional' then raise exception 'Explicit professional license review required'; end if;
   end if;
   update public.documents set status=kind,reference_number=coalesce(payload->>'reference_number',reference_number),plate_number=coalesce(payload->>'plate_number',plate_number),
    expires_on=coalesce((payload->>'expires_on')::date,expires_on),license_kind=coalesce(payload->>'license_kind',license_kind),
    reviewed_vehicle_classes=case when payload ? 'vehicle_classes' then array(select jsonb_array_elements_text(payload->'vehicle_classes')) else reviewed_vehicle_classes end,
    next_reverification_on=(today+interval '1 year')::date,reviewed_by=actor,reviewed_at=now(),rejection_reason=payload->>'reason' where id=target;
   if kind='approved' and d.document_type in ('government_id','drivers_license','professional_license') and payload->>'verified_date_of_birth' is not null then
     if (payload->>'verified_date_of_birth')::date>today then raise exception 'Birth date cannot be in the future'; end if;
     update public.profiles set date_of_birth=(payload->>'verified_date_of_birth')::date where id=d.user_id;
   end if;
   return jsonb_build_object('id',target,'status',kind);
 end if;
 if action='admin.role.review' then
   target=(payload->>'user_id')::uuid; role_name=payload->>'role';
   if role_name not in ('owner','driver') or role_name is null then raise exception 'Admin roles cannot be assigned through this API'; end if;
   kind=payload->>'decision'; if kind not in ('active','rejected','suspended') or kind is null then raise exception 'Role decision required'; end if;
   if kind='active' then
     perform camotes_private.require_documents(target,null,role_name,today);
     if role_name='driver' then update public.driver_profiles set verification_status='approved' where user_id=target; end if;
   end if;
   update public.user_roles set status=kind,verified_by=actor,verified_at=now(),rejection_reason=payload->>'reason' where user_id=target and role=role_name;
   if not found then raise no_data_found using message='Provider request not found'; end if;
   return jsonb_build_object('user_id',target,'status',kind);
 end if;
 if action='admin.vehicle.review' then
   target=(payload->>'id')::uuid; kind=payload->>'decision';
   if kind not in ('approved','rejected','suspended') or kind is null then raise exception 'Listing decision required'; end if;
   if kind='approved' and not exists(select 1 from public.vehicle_photos where vehicle_id=target) then raise exception 'Listing photo required'; end if;
   update public.vehicles set status=kind,with_driver_eligible=case when kind='approved' then coalesce((payload->>'with_driver')::boolean,false) else false end,reviewed_by=actor,reviewed_at=now(),rejection_reason=payload->>'reason' where id=target;
   return jsonb_build_object('id',target,'status',(select status from public.vehicles where id=target));
 end if;
 if action='admin.user.status' then
   target=(payload->>'id')::uuid;
   if target=actor or exists(select 1 from public.user_roles where user_id=target and role='admin' and status='active') then raise exception 'Admin account changes require trusted account administration'; end if;
   kind=payload->>'status'; if kind not in ('active','suspended') or kind is null then raise exception 'Invalid account status'; end if;
   update public.profiles set account_status=kind where id=target;
   insert into public.audit_logs(actor_id,database_role,table_name,record_id,action,changed_fields) values(actor,'authenticated','profiles',target::text,kind,array['account_status']); return '{"saved":true}';
 end if;
 if action='admin.dispute.update' then
   target=(payload->>'id')::uuid; kind=payload->>'status';
   if kind not in ('investigating','resolved','dismissed') or kind is null then raise exception 'Invalid dispute status'; end if;
   if kind in ('resolved','dismissed') and nullif(btrim(payload->>'resolution'),'') is null then raise exception 'Resolution required'; end if;
   update public.reports_disputes set assigned_admin_id=actor,status=kind,resolution=payload->>'resolution',resolved_at=case when kind in ('resolved','dismissed') then now() end where id=target; return '{"saved":true}';
 end if;
 if action='admin.review.hide' then update public.reviews set hidden=(payload->>'hidden')::boolean where id=(payload->>'id')::uuid; return '{"saved":true}'; end if;
 if action='admin.payout.record' then
   target=(payload->>'provider_id')::uuid; amount=(payload->>'amount_centavos')::bigint;
   if payload->>'request_id' is null then raise exception 'Payout request key required'; end if;
   perform pg_advisory_xact_lock(hashtextextended(payload->>'request_id',0));
   select * into payout from public.payouts where idempotency_key=(payload->>'request_id')::uuid;
   if payout.id is not null then
     if payout.recorded_by<>actor or payout.provider_id<>target or payout.amount_centavos<>amount or payout.method is distinct from payload->>'method' or payout.reference_number is distinct from payload->>'reference_number' then raise exception 'Payout key already used'; end if;
     return to_jsonb(payout);
   end if;
   if not exists(select 1 from public.user_roles where user_id=target and role in ('owner','driver') and status='active') then raise exception 'Verified provider required'; end if;
   if payload->>'method'<>'cash' and nullif(btrim(payload->>'reference_number'),'') is null then raise exception 'Payout reference required'; end if;
   insert into public.payouts(provider_id,amount_centavos,status,method,reference_number,recorded_by,paid_at,notes,idempotency_key)
    values(target,amount,'recorded',payload->>'method',payload->>'reference_number',actor,now(),payload->>'notes',(payload->>'request_id')::uuid) returning to_jsonb(payouts) into result;return result;
 end if;
 if action='admin.settings.update' then
   update public.platform_settings set service_fee_bps=coalesce((payload->>'service_fee_bps')::integer,service_fee_bps),cancellation_free_hours=coalesce((payload->>'cancellation_free_hours')::integer,cancellation_free_hours),
    chauffeur_enabled=coalesce((payload->>'chauffeur_enabled')::boolean,chauffeur_enabled),tnc_number=coalesce(payload->>'tnc_number',tnc_number),tnc_issued_on=coalesce((payload->>'tnc_issued_on')::date,tnc_issued_on),tnc_valid_until=coalesce((payload->>'tnc_valid_until')::date,tnc_valid_until),tnc_status=coalesce(payload->>'tnc_status',tnc_status),updated_by=actor where id;
   if exists(select 1 from public.platform_settings where id and chauffeur_enabled and (tnc_issued_on>today or tnc_valid_until<today)) then raise exception 'Current accreditation required'; end if;
   return public.get_public_settings();
 end if;
 raise exception 'Unknown action';
end $$;

revoke all on function public.camotes_read(text,jsonb) from public;
grant execute on function public.camotes_read(text,jsonb) to anon,authenticated;
revoke all on function public.camotes_mutate(text,jsonb) from public,anon;
grant execute on function public.camotes_mutate(text,jsonb) to authenticated;
revoke all on function camotes_private.vehicle_json(public.vehicles),camotes_private.booking_json(public.bookings),camotes_private.owns_upload(text,text),camotes_private.confirm_if_ready(uuid) from public,anon,authenticated;
commit;
