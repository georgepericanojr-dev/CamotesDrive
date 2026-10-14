-- CAMOTESDRIVE / Supabase PostgreSQL initial schema
-- This .md file contains ONLY executable SQL and SQL comments: paste the ENTIRE
-- file into Supabase Dashboard > SQL Editor > New query and Run as postgres.
-- Intended for a NEW project, or a project without these CamotesDrive tables.
-- One-time installation, NOT a rerunnable migration. Existing objects cause a
-- transaction rollback; no DROP TABLE, data deletion, or auth-user seed is used.
-- The app remains mocked. This file does not connect or deploy the frontend.
-- Monetary values are integer PHP centavos. Timestamps are timestamptz / UTC.
-- Private storage objects must be accessed through short-lived signed URLs.

begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists camotes_private;
revoke all on schema camotes_private from public, anon, authenticated;
grant usage on schema camotes_private to authenticated, service_role;
set local search_path = public, extensions, pg_catalog;

-- Expiry dates use the island's calendar day, independent of the DB timezone.
create function camotes_private.today_manila() returns date
language sql stable set search_path = '' as $$
 select (statement_timestamp() at time zone 'Asia/Manila')::date;
$$;

-- Stop before creating anything if the installation already exists.
do $$ begin
  if to_regclass('public.profiles') is not null
     or to_regclass('public.bookings') is not null then
    raise exception 'CamotesDrive tables already exist. Use a reviewed incremental migration instead.';
  end if;
end $$;

create table public.profiles (
  id uuid primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  avatar_path text,
  -- Verified DOB is written by document review, never by the renter.
  date_of_birth date,
  submitted_date_of_birth date,
  account_status text not null default 'active' check (account_status in ('active','suspended','deleted')),
  preferred_mode text not null default 'renter' check (preferred_mode in ('renter','owner','driver')),
  language text not null default 'en',
  notification_preferences jsonb not null default '{"bookings":true,"messages":true,"documents":true}',
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id),
  role text not null check (role in ('renter','owner','driver','admin')),
  status text not null default 'pending' check (status in ('pending','active','rejected','suspended')),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.platform_settings (
  id boolean primary key default true check (id),
  service_fee_bps integer not null default 500 check (service_fee_bps between 0 and 10000),
  cancellation_free_hours integer not null default 48 check (cancellation_free_hours >= 0),
  response_window_hours integer not null default 24 check (response_window_hours between 1 and 168),
  review_window_days integer not null default 30 check (review_window_days between 1 and 365),
  minimum_app_version text not null default '1.0.0',
  chauffeur_enabled boolean not null default false,
  tnc_number text,
  tnc_issued_on date,
  tnc_valid_until date,
  tnc_status text not null default 'missing' check (tnc_status in ('missing','active','expired','revoked')),
  required_documents jsonb not null default '{"renter_self_drive":["government_id","drivers_license"],"renter_chauffeured":["government_id"],"owner":["government_id"],"driver":["government_id","professional_license","nbi_clearance","pnp_clearance"],"vehicle_self_drive":["or_cr","ctpl_insurance"],"vehicle_chauffeured":["or_cr","ctpl_insurance","ltfrb_authority","passenger_insurance"],"business":["business_permit","dti_sec_registration"]}',
  expiry_reminder_days integer[] not null default array[30,7],
  self_drive_authority_required boolean not null default false,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(required_documents) = 'object'),
  check (not chauffeur_enabled or (tnc_status = 'active' and nullif(btrim(tnc_number),'') is not null and tnc_issued_on is not null and tnc_valid_until is not null and tnc_valid_until >= tnc_issued_on))
);
insert into public.platform_settings(id) values (true);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  town text not null check (town in ('San Francisco','Poro','Tudela','Pilar')),
  kind text not null check (kind in ('port','town','resort','other')),
  address text,
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.locations(name,town,kind) values
 ('Consuelo Port','San Francisco','port'), ('Santiago Bay','San Francisco','resort'),
 ('Poro Port','Poro','port'), ('San Francisco town center','San Francisco','town'),
 ('Tudela town center','Tudela','town'), ('Pilar town center','Pilar','town');

create table public.driver_profiles (
  user_id uuid primary key references public.profiles(id),
  bio text check (char_length(bio) <= 2000),
  daily_fee_centavos bigint not null default 0 check (daily_fee_centavos between 0 and 100000000),
  service_areas text[] not null default '{}',
  languages text[] not null default array['English'],
  available_for_hire boolean not null default false,
  verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected','expired','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null check (char_length(name) between 1 and 160),
  vehicle_type text not null check (vehicle_type in ('motorcycle','car','suv','van')),
  make text not null,
  model text not null,
  year integer not null check (year between 1980 and 2100),
  plate_number text not null check (char_length(plate_number) between 3 and 30),
  seats integer not null check (seats between 1 and 60),
  transmission text not null check (transmission in ('automatic','manual')),
  fuel_type text not null check (fuel_type in ('gasoline','diesel','electric','hybrid')),
  pickup_town text not null check (pickup_town in ('San Francisco','Poro','Tudela','Pilar')),
  daily_rate_centavos bigint not null check (daily_rate_centavos between 1 and 100000000),
  deposit_centavos bigint not null default 0 check (deposit_centavos between 0 and 100000000),
  advance_required_centavos bigint not null default 0 check (advance_required_centavos between 0 and 100000000),
  min_rental_days integer not null default 1 check (min_rental_days > 0),
  max_rental_days integer not null default 30 check (max_rental_days >= min_rental_days and max_rental_days <= 365),
  minimum_renter_age integer not null default 18 check (minimum_renter_age between 18 and 99),
  rules text not null default '',
  business_owned boolean not null default false,
  service_type text not null default 'self_drive' check (service_type in ('self_drive','both')),
  with_driver_eligible boolean not null default false,
  ltfrb_case_number text,
  ltfrb_valid_until date,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected','inactive','suspended','deleted')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not with_driver_eligible or (service_type = 'both' and nullif(btrim(ltfrb_case_number),'') is not null and ltfrb_valid_until is not null))
);
create unique index vehicles_plate_unique on public.vehicles(upper(regexp_replace(plate_number,'\s','','g'))) where status <> 'deleted';

create table public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  storage_path text not null unique,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique(vehicle_id,position)
);
create table public.vehicle_pickup_points (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  primary key(vehicle_id,location_id)
);

create table public.vehicle_availability (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default 'unavailable',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table public.driver_availability (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default 'unavailable',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  vehicle_id uuid references public.vehicles(id),
  document_type text not null check (document_type in ('government_id','drivers_license','professional_license','nbi_clearance','pnp_clearance','or_cr','ctpl_insurance','ltfrb_authority','passenger_insurance','business_permit','dti_sec_registration')),
  storage_path text not null unique,
  reference_number text,
  plate_number text,
  issued_on date,
  expires_on date,
  license_kind text check (license_kind in ('professional','non_professional')),
  -- Admin-reviewed vehicle classes; clients cannot grant themselves restrictions.
  reviewed_vehicle_classes text[] not null default '{}',
  next_reverification_on date,
  consent_given_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on),
  check ((document_type in ('or_cr','ctpl_insurance','ltfrb_authority','passenger_insurance')) = (vehicle_id is not null)),
  check (status <> 'approved' or (reviewed_by is not null and reviewed_at is not null and next_reverification_on is not null)),
  check (status <> 'approved' or next_reverification_on <= (reviewed_at at time zone 'Asia/Manila')::date + interval '1 year'),
  check (status <> 'approved' or document_type not in ('drivers_license','professional_license') or cardinality(reviewed_vehicle_classes) > 0),
  check (document_type <> 'professional_license' or status <> 'approved' or license_kind is not distinct from 'professional'),
  check (status <> 'rejected' or nullif(btrim(rejection_reason),'') is not null)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number bigint generated always as identity unique,
  renter_id uuid not null references public.profiles(id),
  owner_id uuid not null references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  driver_id uuid references public.profiles(id),
  service_type text not null check (service_type in ('self_drive','chauffeured')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  rental_period tstzrange generated always as (tstzrange(starts_at,ends_at,'[)')) stored,
  pickup_location_id uuid references public.locations(id),
  return_location_id uuid references public.locations(id),
  pickup_address text,
  return_address text,
  pickup_town text not null,
  rental_days integer not null check (rental_days > 0),
  vehicle_rate_centavos bigint not null check (vehicle_rate_centavos > 0),
  driver_rate_centavos bigint not null default 0 check (driver_rate_centavos >= 0),
  service_fee_bps integer not null check (service_fee_bps between 0 and 10000),
  service_fee_centavos bigint not null check (service_fee_centavos >= 0),
  total_centavos bigint not null check (total_centavos > 0),
  deposit_centavos bigint not null default 0 check (deposit_centavos >= 0),
  advance_required_centavos bigint not null default 0 check (advance_required_centavos >= 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  cancellation_free_hours integer not null default 48,
  status text not null default 'pending_owner' check (status in ('pending_owner','pending_driver','confirmed','in_progress','completed','declined','expired','cancelled_by_renter','cancelled_by_owner','cancelled_by_driver','disputed','no_show')),
  driver_trip_status text not null default 'not_applicable' check (driver_trip_status in ('not_applicable','pending','accepted','en_route','started','completed')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending_verification','paid','partially_refunded','refunded','failed')),
  deposit_status text not null default 'not_required' check (deposit_status in ('not_required','held','returned','partially_withheld','withheld','awaiting_collection')),
  owner_accepted_at timestamptz,
  driver_accepted_at timestamptz,
  response_due_at timestamptz not null,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references public.profiles(id),
  -- Snapshots stay private to booking participants; plate is not public listing data.
  vehicle_plate_snapshot text not null,
  driver_name_snapshot text,
  driver_avatar_snapshot text,
  ltfrb_case_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (renter_id <> owner_id and (driver_id is null or renter_id <> driver_id)),
  check ((service_type = 'self_drive' and driver_id is null and driver_rate_centavos = 0) or (service_type = 'chauffeured' and driver_id is not null)),
  check (pickup_location_id is not null or nullif(btrim(pickup_address),'') is not null),
  check (return_location_id is not null or nullif(btrim(return_address),'') is not null),
  check (total_centavos = rental_days * (vehicle_rate_centavos + driver_rate_centavos) + service_fee_centavos),
  exclude using gist (vehicle_id with =, rental_period with &&)
    where (status in ('confirmed','in_progress','disputed')),
  exclude using gist (driver_id with =, rental_period with &&)
    where (driver_id is not null and status in ('confirmed','in_progress','disputed'))
);

create table public.booking_authorized_drivers (
  booking_id uuid not null references public.bookings(id),
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(booking_id,user_id)
);
create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  actor_id uuid references public.profiles(id),
  event_type text not null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  phase text not null check (phase in ('pickup','return')),
  recorded_by uuid not null references public.profiles(id),
  notes text not null default '',
  fuel_level text,
  odometer_km integer check (odometer_km >= 0),
  photo_paths text[] not null check (cardinality(photo_paths) > 0),
  created_at timestamptz not null default now(),
  unique(booking_id,phase)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  submitted_by uuid not null references public.profiles(id),
  event_type text not null check (event_type in ('rental','advance','deposit_collection','deposit_return','deposit_withholding','refund')),
  amount_centavos bigint not null check (amount_centavos > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  method text not null check (method in ('cash','gcash','maya','bank_transfer')),
  reference_number text,
  proof_path text,
  status text not null default 'pending_verification' check (status in ('pending_verification','confirmed','rejected')),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  idempotency_key uuid not null default gen_random_uuid() unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'confirmed' or (confirmed_by is not null and confirmed_at is not null))
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id),
  created_at timestamptz not null default now()
);
create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id),
  blocked_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id), check (blocker_id <> blocked_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id),
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  client_message_id uuid not null,
  created_at timestamptz not null default now(),
  unique(sender_id,client_message_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  mode text not null default 'renter' check (mode in ('renter','owner','driver','admin')),
  kind text not null,
  title text not null,
  body text not null,
  booking_id uuid references public.bookings(id),
  read_at timestamptz,
  deduplication_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  token text not null unique,
  platform text not null check (platform in ('ios','android','web')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  reviewer_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in ('vehicle','driver')),
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.profiles(id),
  rating integer not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  provider_reply text check (char_length(provider_reply) <= 2000),
  replied_at timestamptz,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique(booking_id,target_type),
  check ((target_type = 'vehicle' and vehicle_id is not null and driver_id is null) or (target_type = 'driver' and driver_id is not null and vehicle_id is null))
);
create table public.favorites (
  user_id uuid not null references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,vehicle_id)
);
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id),
  amount_centavos bigint not null check (amount_centavos > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  status text not null default 'pending' check (status in ('pending','recorded','failed','cancelled')),
  method text not null check (method in ('cash','gcash','maya','bank_transfer')),
  reference_number text,
  recorded_by uuid references public.profiles(id),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.reports_disputes (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  booking_id uuid references public.bookings(id),
  reported_user_id uuid references public.profiles(id),
  message_id uuid references public.messages(id),
  category text not null check (category in ('damage','deposit','payment','no_show','message','safety','other')),
  description text not null check (char_length(description) between 1 and 4000),
  status text not null default 'open' check (status in ('open','investigating','resolved','dismissed')),
  assigned_admin_id uuid references public.profiles(id),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  database_role text not null,
  table_name text not null,
  record_id text,
  action text not null,
  -- Metadata excludes full documents, phones, payment references, and message bodies.
  changed_fields text[],
  created_at timestamptz not null default now()
);

-- Indexes support role/ownership policies and common paginated queries.
create index roles_status_idx on public.user_roles(role,status,user_id);
create index vehicles_browse_idx on public.vehicles(status,vehicle_type,pickup_town,daily_rate_centavos);
create index vehicles_owner_idx on public.vehicles(owner_id,status);
create index vehicle_blocks_idx on public.vehicle_availability(vehicle_id,starts_at,ends_at);
create index driver_blocks_idx on public.driver_availability(driver_id,starts_at,ends_at);
create index documents_user_idx on public.documents(user_id,document_type,status);
create index documents_vehicle_idx on public.documents(vehicle_id,document_type,status);
create index documents_expiry_idx on public.documents(expires_on) where status = 'approved';
create index bookings_renter_idx on public.bookings(renter_id,created_at desc);
create index bookings_owner_idx on public.bookings(owner_id,starts_at);
create index bookings_driver_idx on public.bookings(driver_id,starts_at) where driver_id is not null;
create index bookings_vehicle_idx on public.bookings(vehicle_id,starts_at);
create index bookings_expiry_idx on public.bookings(response_due_at) where status in ('pending_owner','pending_driver');
create index authorized_user_idx on public.booking_authorized_drivers(user_id);
create index events_booking_idx on public.booking_events(booking_id,created_at);
create index handovers_booking_idx on public.handovers(booking_id);
create index payments_booking_idx on public.payments(booking_id,created_at);
create index messages_conversation_idx on public.messages(conversation_id,created_at,id);
create index conversations_booking_idx on public.conversations(booking_id);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create index device_tokens_user_idx on public.device_tokens(user_id);
create index reviews_vehicle_idx on public.reviews(vehicle_id) where not hidden;
create index reviews_driver_idx on public.reviews(driver_id) where not hidden;
create index payouts_provider_idx on public.payouts(provider_id,created_at desc);
create index reports_booking_idx on public.reports_disputes(booking_id,status);
create index reports_reporter_idx on public.reports_disputes(reporter_id);
create index reports_admin_idx on public.reports_disputes(assigned_admin_id,status);
create index audit_time_idx on public.audit_logs(created_at desc);

-- Helpers live outside public, have pinned search paths, and do not accept an
-- arbitrary caller ID. RLS helpers run as owner to avoid recursive policies.
create function camotes_private.account_active() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = auth.uid() and auth_user_id = auth.uid() and account_status = 'active');
$$;
create function camotes_private.has_role(p_role text) returns boolean
language sql stable security definer set search_path = '' as $$
 select camotes_private.account_active() and exists(select 1 from public.user_roles where user_id = auth.uid() and role = p_role and status = 'active');
$$;
create function camotes_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select camotes_private.has_role('admin') and coalesce(auth.jwt()->>'aal','') = 'aal2';
$$;
create function camotes_private.owns_vehicle(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select camotes_private.account_active() and exists(select 1 from public.vehicles where id = p_id and owner_id = auth.uid());
$$;
create function camotes_private.draft_vehicle(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select camotes_private.has_role('owner') and exists(select 1 from public.vehicles where id = p_id and owner_id = auth.uid() and status = 'draft');
$$;
create function camotes_private.visible_vehicle(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.vehicles v join public.profiles p on p.id = v.owner_id
 where v.id = p_id and v.status = 'approved' and p.account_status = 'active'
 and exists(select 1 from public.user_roles r where r.user_id = v.owner_id and r.role = 'owner' and r.status = 'active'));
$$;
create function camotes_private.booking_participant(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select camotes_private.account_active() and exists(select 1 from public.bookings where id = p_id and auth.uid() in (renter_id,owner_id,driver_id));
$$;
create function camotes_private.dispute_admin(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select camotes_private.is_admin() and exists(select 1 from public.reports_disputes where booking_id = p_booking and assigned_admin_id = auth.uid() and status in ('open','investigating'));
$$;
create function camotes_private.chat_access(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.conversations where id = p_conversation and (camotes_private.booking_participant(booking_id) or camotes_private.dispute_admin(booking_id)));
$$;
create function camotes_private.can_message(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.conversations c join public.bookings b on b.id = c.booking_id
 where c.id = p_conversation and camotes_private.booking_participant(b.id)
 and not exists(select 1 from public.user_blocks u where
   (u.blocker_id = auth.uid() and u.blocked_id in (b.renter_id,b.owner_id,b.driver_id)) or
   (u.blocked_id = auth.uid() and u.blocker_id in (b.renter_id,b.owner_id,b.driver_id))));
$$;

-- Internal eligibility checks: approved, nonexpired, annually re-reviewed docs.
create function camotes_private.has_document(p_user uuid,p_vehicle uuid,p_type text,p_through date) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.documents d where d.user_id = p_user and d.vehicle_id is not distinct from p_vehicle
 and d.document_type = p_type and d.status = 'approved'
 and (d.issued_on is null or d.issued_on <= camotes_private.today_manila())
 and d.next_reverification_on >= p_through
 and (d.expires_on >= p_through or (d.expires_on is null and p_type in ('government_id','or_cr','dti_sec_registration')))
 and (p_type <> 'professional_license' or d.license_kind = 'professional'));
$$;
create function camotes_private.require_documents(p_user uuid,p_vehicle uuid,p_group text,p_through date) returns void
language plpgsql security definer set search_path = '' as $$
declare k text; required jsonb;
begin
 select required_documents->p_group into required from public.platform_settings where id;
 if required is null or jsonb_typeof(required) <> 'array' or jsonb_array_length(required) = 0 then
   raise exception 'Missing document configuration for %',p_group;
 end if;
 for k in select jsonb_array_elements_text(required) loop
   if not camotes_private.has_document(p_user,p_vehicle,k,p_through) then
     raise exception 'Missing or expired approved document: %',k;
   end if;
 end loop;
end;
$$;

create function camotes_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create function camotes_private.provision_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,auth_user_id,full_name)
 values(new.id,new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),120));
 insert into public.user_roles(user_id,role,status) values(new.id,'renter','active');
 return new;
end $$;
create trigger camotes_auth_signup after insert on auth.users for each row execute function camotes_private.provision_user();
-- Backfill already registered users without trusting their role metadata.
insert into public.profiles(id,auth_user_id,full_name)
 select id,id,left(coalesce(raw_user_meta_data->>'full_name',''),120) from auth.users;
insert into public.user_roles(user_id,role,status) select id,'renter','active' from public.profiles;

create function camotes_private.validate_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.status = 'active' and new.role in ('owner','driver') then
   perform camotes_private.require_documents(new.user_id,null,new.role,camotes_private.today_manila());
   if new.verified_by is null or new.verified_at is null then raise exception 'Provider role requires a recorded reviewer'; end if;
   if new.role = 'driver' and (not camotes_private.has_document(new.user_id,null,'professional_license',camotes_private.today_manila())
      or not exists(select 1 from public.driver_profiles where user_id = new.user_id and verification_status = 'approved')) then
     raise exception 'Driver requires approved professional license and driver profile';
   end if;
 end if;
 return new;
end $$;
create trigger validate_role before insert or update on public.user_roles for each row execute function camotes_private.validate_role();

create function camotes_private.validate_vehicle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'UPDATE' and old.status = 'approved' and
   (to_jsonb(new) - array['status','updated_at']) is distinct from (to_jsonb(old) - array['status','updated_at']) then
   new.status = 'pending'; new.with_driver_eligible = false; new.reviewed_at = null; new.reviewed_by = null;
 end if;
 if new.status = 'approved' then
   if not exists(select 1 from public.user_roles where user_id = new.owner_id and role = 'owner' and status = 'active') then
     raise exception 'An active owner role is required';
   end if;
   perform camotes_private.require_documents(new.owner_id,new.id,'vehicle_self_drive',camotes_private.today_manila());
   if not exists(select 1 from public.profiles p join auth.users u on u.id = p.auth_user_id
       where p.id = new.owner_id and p.account_status = 'active' and u.email_confirmed_at is not null) then
     raise exception 'Listing owner requires an active account and verified email'; end if;
   if not exists(select 1 from public.documents where vehicle_id = new.id and document_type = 'or_cr' and status = 'approved'
       and upper(regexp_replace(plate_number,'\s','','g')) = upper(regexp_replace(new.plate_number,'\s','','g'))) then
     raise exception 'Approved OR/CR plate must match the vehicle'; end if;
   if new.business_owned then perform camotes_private.require_documents(new.owner_id,null,'business',camotes_private.today_manila()); end if;
   if new.reviewed_by is null or new.reviewed_at is null then raise exception 'Listing approval requires a recorded reviewer'; end if;
 end if;
 if new.with_driver_eligible then
   perform camotes_private.require_documents(new.owner_id,new.id,'vehicle_chauffeured',camotes_private.today_manila());
   if not exists(select 1 from public.documents where vehicle_id = new.id and document_type = 'ltfrb_authority'
       and status = 'approved' and reference_number = new.ltfrb_case_number
       and upper(regexp_replace(plate_number,'\s','','g')) = upper(regexp_replace(new.plate_number,'\s','','g'))
       and expires_on = new.ltfrb_valid_until) then raise exception 'Approved authority must match the vehicle case number, plate and expiry'; end if;
 end if;
 return new;
end $$;
create trigger validate_vehicle before insert or update on public.vehicles for each row execute function camotes_private.validate_vehicle();

-- Server writes create bookings; prices are recalculated here, never accepted
-- from the app. Critical identity/time/price snapshots cannot be edited later.
create function camotes_private.validate_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v public.vehicles%rowtype; s public.platform_settings%rowtype; d public.driver_profiles%rowtype;
 through_date date; driver_user uuid; last_day date; subtotal numeric;
begin
 if tg_op = 'UPDATE' and (to_jsonb(new) - array['status','driver_trip_status','payment_status','deposit_status','owner_accepted_at','driver_accepted_at','response_due_at','confirmed_at','completed_at','cancellation_reason','cancelled_by','updated_at','rental_period'])
   is distinct from (to_jsonb(old) - array['status','driver_trip_status','payment_status','deposit_status','owner_accepted_at','driver_accepted_at','response_due_at','confirmed_at','completed_at','cancellation_reason','cancelled_by','updated_at','rental_period']) then
   raise exception 'Booking identity, schedule and price snapshot are immutable; cancel and rebook';
 end if;
 select * into v from public.vehicles where id = new.vehicle_id for update;
 select * into s from public.platform_settings where id for share;
 if tg_op = 'INSERT' then
   if new.starts_at <= now() or new.ends_at <= new.starts_at then raise exception 'Choose a future valid rental period'; end if;
   if new.status <> 'pending_owner' then raise exception 'New bookings must begin pending_owner'; end if;
   new.owner_id = v.owner_id;
   new.rental_days = ceil(extract(epoch from (new.ends_at-new.starts_at))/86400.0)::integer;
   if new.rental_days < v.min_rental_days or new.rental_days > v.max_rental_days then raise exception 'Rental length outside listing limits'; end if;
   new.vehicle_rate_centavos = v.daily_rate_centavos;
   new.driver_rate_centavos = 0;
   new.driver_trip_status = case when new.service_type = 'chauffeured' then 'pending' else 'not_applicable' end;
   if new.driver_id is not null then
     select * into d from public.driver_profiles where user_id = new.driver_id for update;
     new.driver_rate_centavos = d.daily_fee_centavos;
     select full_name,avatar_path into new.driver_name_snapshot,new.driver_avatar_snapshot from public.profiles where id = new.driver_id;
   end if;
   subtotal = new.rental_days::numeric * (new.vehicle_rate_centavos + new.driver_rate_centavos);
   new.service_fee_bps = s.service_fee_bps;
   new.service_fee_centavos = round(subtotal*s.service_fee_bps/10000.0)::bigint;
   new.total_centavos = subtotal + new.service_fee_centavos;
   new.deposit_centavos = v.deposit_centavos;
   new.advance_required_centavos = v.advance_required_centavos;
   new.cancellation_free_hours = s.cancellation_free_hours;
   new.vehicle_plate_snapshot = v.plate_number;
   new.ltfrb_case_snapshot = case when new.service_type = 'chauffeured' then v.ltfrb_case_number end;
   new.response_due_at = now()+make_interval(hours=>s.response_window_hours);
   new.deposit_status = case when v.deposit_centavos = 0 then 'not_required' else 'awaiting_collection' end;
 end if;
 if tg_op = 'UPDATE' and new.status is distinct from old.status then
   if not (
     (old.status = 'pending_owner' and new.status in ('pending_driver','confirmed','declined','expired','cancelled_by_renter','cancelled_by_owner')) or
     (old.status = 'pending_driver' and new.status in ('confirmed','declined','expired','cancelled_by_renter','cancelled_by_owner','cancelled_by_driver')) or
     (old.status = 'confirmed' and new.status in ('in_progress','cancelled_by_renter','cancelled_by_owner','cancelled_by_driver','disputed','no_show')) or
     (old.status = 'in_progress' and new.status in ('completed','disputed')) or
     (old.status = 'completed' and new.status = 'disputed') or
     (old.status = 'disputed' and new.status in ('completed','cancelled_by_renter','cancelled_by_owner','cancelled_by_driver'))
   ) then raise exception 'Invalid booking transition: % -> %',old.status,new.status; end if;
   if new.status = 'pending_driver' and (new.driver_id is null or new.owner_accepted_at is null) then raise exception 'Driver request requires owner acceptance'; end if;
 end if;
 if new.service_type = 'self_drive' and new.driver_trip_status <> 'not_applicable' then raise exception 'Self-drive has no provider driver status'; end if;
 if new.driver_trip_status = 'en_route' and new.status <> 'confirmed' then raise exception 'En route requires a confirmed chauffeured booking'; end if;
 if new.driver_trip_status = 'started' and new.status <> 'in_progress' then raise exception 'Started driver trip requires an in-progress booking'; end if;
 if new.driver_trip_status = 'completed' and new.status <> 'completed' then raise exception 'Completed driver trip requires a completed booking'; end if;
 if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status <> new.status and new.status in ('confirmed','in_progress')) then
   through_date = (new.ends_at at time zone 'Asia/Manila')::date;
   if v.status <> 'approved' or not exists(select 1 from public.profiles where id = v.owner_id and account_status = 'active')
      or not exists(select 1 from public.user_roles where user_id = v.owner_id and role = 'owner' and status = 'active') then raise exception 'Vehicle / owner unavailable'; end if;
   if not exists(select 1 from public.profiles p join auth.users u on u.id = p.auth_user_id
       where p.id = new.renter_id and p.account_status = 'active' and u.email_confirmed_at is not null
       and nullif(btrim(p.phone),'') is not null and p.terms_accepted_at is not null and p.privacy_accepted_at is not null) then
     raise exception 'Renter requires active profile, verified email, phone and terms/privacy consent'; end if;
   if exists(select 1 from public.vehicle_availability where vehicle_id = new.vehicle_id
      and tstzrange(starts_at,ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Vehicle dates blocked'; end if;
   perform camotes_private.require_documents(v.owner_id,null,'owner',through_date);
   perform camotes_private.require_documents(v.owner_id,new.vehicle_id,'vehicle_self_drive',through_date);
   if v.business_owned then perform camotes_private.require_documents(v.owner_id,null,'business',through_date); end if;
   if new.service_type = 'self_drive' then
     if new.driver_id is not null then raise exception 'Self-drive cannot include a supplied driver'; end if;
     perform camotes_private.require_documents(new.renter_id,null,'renter_self_drive',through_date);
     if not exists(select 1 from public.profiles where id = new.renter_id and date_of_birth <= ((new.starts_at at time zone 'Asia/Manila')::date - make_interval(years=>v.minimum_renter_age))) then raise exception 'Renter age does not meet listing minimum'; end if;
     if not exists(select 1 from public.documents where user_id = new.renter_id and document_type in ('drivers_license','professional_license')
       and status = 'approved' and v.vehicle_type = any(reviewed_vehicle_classes) and expires_on >= through_date and next_reverification_on >= through_date) then raise exception 'License is not approved for this vehicle class'; end if;
     if s.self_drive_authority_required and not camotes_private.has_document(v.owner_id,v.id,'ltfrb_authority',through_date) then raise exception 'Self-drive authority required by platform settings'; end if;
   else
     if not s.chauffeur_enabled or s.tnc_status <> 'active' or s.tnc_issued_on is null or s.tnc_valid_until is null or s.tnc_issued_on > camotes_private.today_manila() or s.tnc_valid_until < through_date then raise exception 'Active TNC accreditation covering the trip is required'; end if;
     if v.vehicle_type = 'motorcycle' then raise exception 'Motorcycle chauffeur service is out of scope'; end if;
     if not v.with_driver_eligible or v.service_type <> 'both' or v.ltfrb_valid_until < through_date then raise exception 'Vehicle authority does not cover this trip'; end if;
     perform camotes_private.require_documents(v.owner_id,v.id,'vehicle_chauffeured',through_date);
     if not exists(select 1 from public.documents where vehicle_id = v.id and document_type = 'ltfrb_authority'
        and status = 'approved' and reference_number = v.ltfrb_case_number and expires_on >= through_date
        and next_reverification_on >= through_date
        and upper(regexp_replace(plate_number,'\s','','g')) = upper(regexp_replace(v.plate_number,'\s','','g'))) then
        raise exception 'Current approved authority must match the vehicle case and plate'; end if;
     perform camotes_private.require_documents(new.renter_id,null,'renter_chauffeured',through_date);
     perform camotes_private.require_documents(new.driver_id,null,'driver',through_date);
     if not camotes_private.has_document(new.driver_id,null,'professional_license',through_date) then raise exception 'Professional license required'; end if;
     if not exists(select 1 from public.documents where user_id = new.driver_id and document_type = 'professional_license'
        and status = 'approved' and license_kind = 'professional' and v.vehicle_type = any(reviewed_vehicle_classes)
        and expires_on >= through_date and next_reverification_on >= through_date) then
        raise exception 'Professional driver license does not cover the vehicle class'; end if;
     select * into d from public.driver_profiles where user_id = new.driver_id for update;
     if d.user_id is null or d.verification_status <> 'approved' or not d.available_for_hire or not (new.pickup_town = any(d.service_areas))
       or not exists(select 1 from public.profiles where id = new.driver_id and account_status = 'active')
       or not exists(select 1 from public.user_roles where user_id = new.driver_id and role = 'driver' and status = 'active') then raise exception 'Driver not eligible or outside service area'; end if;
     if exists(select 1 from public.driver_availability where driver_id = new.driver_id and tstzrange(starts_at,ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Driver dates blocked'; end if;
   end if;
   for driver_user in select user_id from public.booking_authorized_drivers where booking_id = new.id loop
     if new.service_type <> 'self_drive' or driver_user in (new.owner_id,new.driver_id,new.renter_id) then raise exception 'Invalid additional self-drive driver'; end if;
     perform camotes_private.require_documents(driver_user,null,'renter_self_drive',through_date);
     if not exists(select 1 from public.documents where user_id = driver_user and status = 'approved'
       and document_type in ('drivers_license','professional_license') and v.vehicle_type = any(reviewed_vehicle_classes)
       and expires_on >= through_date and next_reverification_on >= through_date) then raise exception 'Additional driver license class invalid'; end if;
   end loop;
 end if;
 if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed') then
   if new.response_due_at <= now() or new.starts_at <= now() or new.owner_accepted_at is null
      or (new.driver_id is not null and new.driver_accepted_at is null) then raise exception 'All provider acceptances must arrive before deadline and pickup'; end if;
   if new.advance_required_centavos > coalesce((select sum(amount_centavos) from public.payments
     where booking_id = new.id and event_type in ('advance','rental') and status = 'confirmed'),0) then raise exception 'Required advance payment not confirmed'; end if;
   new.confirmed_at = now();
 end if;
 if new.status = 'completed' and old.status is distinct from 'completed' then new.completed_at = now(); end if;
 return new;
end $$;
create trigger validate_booking before insert or update on public.bookings for each row execute function camotes_private.validate_booking();

-- Calendar changes serialize on the SAME parent rows as booking confirmation.
-- An owner cannot insert a maintenance block over an already committed rental.
create function camotes_private.validate_calendar_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_table_name = 'vehicle_availability' then
   perform 1 from public.vehicles where id = new.vehicle_id for update;
   if exists(select 1 from public.bookings where vehicle_id = new.vehicle_id
      and status in ('confirmed','in_progress','disputed')
      and rental_period && tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Vehicle block conflicts with a committed booking'; end if;
 else
   perform 1 from public.driver_profiles where user_id = new.driver_id for update;
   if exists(select 1 from public.bookings where driver_id = new.driver_id
      and status in ('confirmed','in_progress','disputed')
      and rental_period && tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Driver block conflicts with a committed booking'; end if;
 end if;
 return new;
end $$;
create trigger validate_vehicle_block before insert or update on public.vehicle_availability for each row execute function camotes_private.validate_calendar_block();
create trigger validate_driver_block before insert or update on public.driver_availability for each row execute function camotes_private.validate_calendar_block();

create function camotes_private.validate_authorized_driver() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; v public.vehicles%rowtype; through_date date;
begin
 select * into b from public.bookings where id = new.booking_id for update;
 select * into v from public.vehicles where id = b.vehicle_id;
 through_date = (b.ends_at at time zone 'Asia/Manila')::date;
 if b.id is null or b.service_type <> 'self_drive' or b.status not in ('pending_owner','confirmed')
    or new.user_id in (b.renter_id,b.owner_id) then raise exception 'Only a separate verified self-drive driver can be added before pickup'; end if;
 perform camotes_private.require_documents(new.user_id,null,'renter_self_drive',through_date);
 if not exists(select 1 from public.profiles where id = new.user_id and account_status = 'active'
     and date_of_birth <= ((b.starts_at at time zone 'Asia/Manila')::date - make_interval(years=>v.minimum_renter_age))) then raise exception 'Additional driver age/account is ineligible'; end if;
 if not exists(select 1 from public.documents where user_id = new.user_id and status = 'approved'
    and document_type in ('drivers_license','professional_license') and v.vehicle_type = any(reviewed_vehicle_classes)
    and expires_on >= through_date and next_reverification_on >= through_date) then raise exception 'Additional driver license class invalid'; end if;
 return new;
end $$;
create trigger validate_authorized_driver before insert or update on public.booking_authorized_drivers for each row execute function camotes_private.validate_authorized_driver();

create function camotes_private.record_booking_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'INSERT' then
   insert into public.conversations(booking_id) values(new.id);
 end if;
 if tg_op = 'INSERT' or (old.status,old.driver_trip_status,old.payment_status,old.deposit_status) is distinct from (new.status,new.driver_trip_status,new.payment_status,new.deposit_status) then
   insert into public.booking_events(booking_id,actor_id,event_type,old_values,new_values,reason)
   values(new.id,auth.uid(),case when tg_op = 'INSERT' then 'created' else 'status_changed' end,
     case when tg_op = 'UPDATE' then jsonb_build_object('status',old.status,'driver_trip_status',old.driver_trip_status,'payment_status',old.payment_status,'deposit_status',old.deposit_status) end,
     jsonb_build_object('status',new.status,'driver_trip_status',new.driver_trip_status,'payment_status',new.payment_status,'deposit_status',new.deposit_status),new.cancellation_reason);
 end if;
 return new;
end $$;
create trigger booking_history after insert or update on public.bookings for each row execute function camotes_private.record_booking_event();

create function camotes_private.validate_review() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; window_days integer;
begin
 select * into b from public.bookings where id = new.booking_id;
 select review_window_days into window_days from public.platform_settings where id;
 if b.id is null or b.renter_id <> new.reviewer_id or b.status <> 'completed' or b.completed_at is null
   or now() > b.completed_at + make_interval(days=>window_days) then raise exception 'Review requires your completed booking within review window'; end if;
 if new.target_type = 'vehicle' and new.vehicle_id is distinct from b.vehicle_id then raise exception 'Wrong vehicle for review'; end if;
 if new.target_type = 'driver' and (b.driver_id is null or new.driver_id is distinct from b.driver_id) then raise exception 'Wrong driver for review'; end if;
 return new;
end $$;
create trigger validate_review before insert on public.reviews for each row execute function camotes_private.validate_review();

create function camotes_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare row_new jsonb; row_old jsonb; fields text[];
begin
 if tg_op <> 'DELETE' then row_new = to_jsonb(new); end if;
 if tg_op <> 'INSERT' then row_old = to_jsonb(old); end if;
 select array_agg(key order by key) into fields from jsonb_each(coalesce(row_new,row_old)) x
   where row_new->key is distinct from row_old->key;
 insert into public.audit_logs(actor_id,database_role,table_name,record_id,action,changed_fields)
 values(auth.uid(),coalesce(auth.role(),session_user),tg_table_name,
   coalesce(row_new->>'id',row_old->>'id',row_new->>'user_id',row_old->>'user_id'),tg_op,fields);
 return null;
end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','platform_settings','locations','driver_profiles','vehicles','documents','bookings','payments','notifications','payouts','reports_disputes'] loop
   execute format('create trigger touch_updated before update on public.%I for each row execute function camotes_private.touch_updated_at()',t);
 end loop;
 foreach t in array array['user_roles','platform_settings','driver_profiles','vehicles','documents','bookings','payments','handovers','payouts','reports_disputes','reviews'] loop
   execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function camotes_private.audit_change()',t);
 end loop;
end $$;

-- RLS + explicit privileges. Sensitive mutations are intentionally service-only.
-- Edge Functions MUST authenticate the user, authorize the actor and enforce MFA
-- for admins before using service_role. Never ship service_role in the app.
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','platform_settings','locations','driver_profiles','vehicles','vehicle_photos','vehicle_pickup_points','vehicle_availability','driver_availability','documents','bookings','booking_authorized_drivers','booking_events','handovers','payments','conversations','user_blocks','messages','notifications','device_tokens','reviews','favorites','payouts','reports_disputes','audit_logs'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on table public.%I from anon, authenticated',t);
   execute format('grant all on table public.%I to service_role',t);
 end loop;
end $$;
grant usage on schema public to anon,authenticated,service_role;
grant usage,select on sequence public.bookings_booking_number_seq to service_role;

grant select on public.profiles,public.user_roles,public.platform_settings,public.driver_profiles,
 public.vehicle_photos,public.vehicle_pickup_points,public.vehicle_availability,public.driver_availability,
 public.documents,public.bookings,public.booking_authorized_drivers,public.booking_events,public.handovers,
 public.payments,public.conversations,public.user_blocks,public.messages,public.notifications,
 public.device_tokens,public.favorites,public.payouts,public.reports_disputes,public.audit_logs to authenticated;
grant select on public.locations to anon,authenticated;
grant select(id,owner_id,name,vehicle_type,make,model,year,seats,transmission,fuel_type,pickup_town,
 daily_rate_centavos,deposit_centavos,advance_required_centavos,min_rental_days,max_rental_days,minimum_renter_age,
 rules,service_type,status,created_at,updated_at) on public.vehicles to anon,authenticated;
-- Explicit review projection hides booking IDs/reviewer IDs from public readers.
grant select(id,target_type,vehicle_id,driver_id,rating,comment,provider_reply,replied_at,hidden,created_at) on public.reviews to anon,authenticated;
grant select on public.vehicle_photos,public.vehicle_pickup_points to anon;
grant update(full_name,phone,avatar_path,submitted_date_of_birth,preferred_mode,language,notification_preferences,
 terms_accepted_at,privacy_accepted_at,deletion_requested_at) on public.profiles to authenticated;
grant insert(user_id,role) on public.user_roles to authenticated;
grant insert(user_id,bio,daily_fee_centavos,service_areas,languages,available_for_hire) on public.driver_profiles to authenticated;
grant update(bio,daily_fee_centavos,service_areas,languages,available_for_hire) on public.driver_profiles to authenticated;
grant insert(owner_id,name,vehicle_type,make,model,year,plate_number,seats,transmission,fuel_type,pickup_town,daily_rate_centavos,deposit_centavos,advance_required_centavos,min_rental_days,max_rental_days,minimum_renter_age,rules,business_owned,service_type,ltfrb_case_number,ltfrb_valid_until) on public.vehicles to authenticated;
grant update(name,vehicle_type,make,model,year,plate_number,seats,transmission,fuel_type,pickup_town,daily_rate_centavos,deposit_centavos,advance_required_centavos,min_rental_days,max_rental_days,minimum_renter_age,rules,business_owned,service_type,ltfrb_case_number,ltfrb_valid_until) on public.vehicles to authenticated;
grant insert(vehicle_id,storage_path,position), delete on public.vehicle_photos to authenticated;
grant insert(vehicle_id,location_id), delete on public.vehicle_pickup_points to authenticated;
grant insert(user_id,vehicle_id,document_type,storage_path,reference_number,plate_number,issued_on,expires_on,license_kind,consent_given_at) on public.documents to authenticated;
grant insert(user_id,vehicle_id),delete on public.favorites to authenticated;
grant insert(blocker_id,blocked_id),delete on public.user_blocks to authenticated;
grant insert(conversation_id,sender_id,body,client_message_id) on public.messages to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant insert(user_id,token,platform,active,last_seen_at),delete on public.device_tokens to authenticated;
grant update(active,last_seen_at) on public.device_tokens to authenticated;
grant insert(booking_id,reviewer_id,target_type,vehicle_id,driver_id,rating,comment) on public.reviews to authenticated;
grant insert(reporter_id,booking_id,reported_user_id,message_id,category,description) on public.reports_disputes to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or camotes_private.is_admin());
create policy profiles_edit on public.profiles for update to authenticated using (id = auth.uid() and camotes_private.account_active()) with check (id = auth.uid());
create policy roles_read on public.user_roles for select to authenticated using (user_id = auth.uid() or camotes_private.is_admin());
create policy role_requests on public.user_roles for insert to authenticated with check (user_id = auth.uid() and role in ('owner','driver') and status = 'pending' and verified_at is null and verified_by is null and camotes_private.account_active());
create policy settings_read on public.platform_settings for select to authenticated using (camotes_private.is_admin());
create policy locations_read on public.locations for select to anon,authenticated using (active or camotes_private.is_admin());
create policy driver_read on public.driver_profiles for select to authenticated using (user_id = auth.uid() or camotes_private.is_admin());
create policy driver_insert on public.driver_profiles for insert to authenticated with check (user_id = auth.uid() and camotes_private.account_active() and verification_status = 'pending');
create policy driver_edit on public.driver_profiles for update to authenticated using (user_id = auth.uid() and camotes_private.account_active()) with check (user_id = auth.uid());
create policy vehicles_read on public.vehicles for select to anon,authenticated using (camotes_private.visible_vehicle(id) or camotes_private.owns_vehicle(id) or camotes_private.is_admin());
create policy vehicles_insert on public.vehicles for insert to authenticated with check (owner_id = auth.uid() and camotes_private.has_role('owner') and status = 'draft' and not with_driver_eligible);
create policy vehicles_edit_draft on public.vehicles for update to authenticated using (camotes_private.draft_vehicle(id)) with check (owner_id = auth.uid() and status = 'draft');
create policy photos_read on public.vehicle_photos for select to anon,authenticated using (camotes_private.visible_vehicle(vehicle_id) or camotes_private.owns_vehicle(vehicle_id) or camotes_private.is_admin());
create policy photos_insert on public.vehicle_photos for insert to authenticated with check (camotes_private.draft_vehicle(vehicle_id) and split_part(storage_path,'/',1) = auth.uid()::text and split_part(storage_path,'/',2) = vehicle_id::text);
create policy photos_delete on public.vehicle_photos for delete to authenticated using (camotes_private.draft_vehicle(vehicle_id));
create policy pickups_read on public.vehicle_pickup_points for select to anon,authenticated using (camotes_private.visible_vehicle(vehicle_id) or camotes_private.owns_vehicle(vehicle_id) or camotes_private.is_admin());
create policy pickups_insert on public.vehicle_pickup_points for insert to authenticated with check (camotes_private.draft_vehicle(vehicle_id));
create policy pickups_delete on public.vehicle_pickup_points for delete to authenticated using (camotes_private.draft_vehicle(vehicle_id));
create policy vehicle_blocks_read on public.vehicle_availability for select to authenticated using (camotes_private.owns_vehicle(vehicle_id) or camotes_private.is_admin());
create policy driver_blocks_read on public.driver_availability for select to authenticated using (driver_id = auth.uid() or camotes_private.is_admin());
create policy documents_read on public.documents for select to authenticated using (user_id = auth.uid() or camotes_private.is_admin());
create policy documents_submit on public.documents for insert to authenticated with check (user_id = auth.uid() and camotes_private.account_active() and (vehicle_id is null or camotes_private.owns_vehicle(vehicle_id)) and status = 'pending' and split_part(storage_path,'/',1) = auth.uid()::text);
create policy bookings_read on public.bookings for select to authenticated using (camotes_private.booking_participant(id) or camotes_private.is_admin());
create policy authorized_drivers_read on public.booking_authorized_drivers for select to authenticated using (camotes_private.booking_participant(booking_id) or user_id = auth.uid() or camotes_private.is_admin());
create policy events_read on public.booking_events for select to authenticated using (camotes_private.booking_participant(booking_id) or camotes_private.is_admin());
create policy handovers_read on public.handovers for select to authenticated using (camotes_private.booking_participant(booking_id) or camotes_private.dispute_admin(booking_id));
create policy payments_read on public.payments for select to authenticated using (
 camotes_private.is_admin() or (camotes_private.account_active() and exists(
   select 1 from public.bookings b where b.id = booking_id and auth.uid() in (b.renter_id,b.owner_id))));
create policy conversations_read on public.conversations for select to authenticated using (camotes_private.booking_participant(booking_id) or camotes_private.dispute_admin(booking_id));
create policy messages_read on public.messages for select to authenticated using (camotes_private.chat_access(conversation_id));
create policy messages_send on public.messages for insert to authenticated with check (sender_id = auth.uid() and camotes_private.can_message(conversation_id));
create policy blocks_read on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid() and camotes_private.account_active());
create policy blocks_delete on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid() and camotes_private.account_active());
create policy notifications_read_state on public.notifications for update to authenticated using (user_id = auth.uid() and camotes_private.account_active()) with check (user_id = auth.uid());
create policy tokens_read on public.device_tokens for select to authenticated using (user_id = auth.uid() and camotes_private.account_active());
create policy tokens_insert on public.device_tokens for insert to authenticated with check (user_id = auth.uid() and camotes_private.account_active());
create policy tokens_edit on public.device_tokens for update to authenticated using (user_id = auth.uid() and camotes_private.account_active()) with check (user_id = auth.uid());
create policy tokens_delete on public.device_tokens for delete to authenticated using (user_id = auth.uid());
create policy favorites_read on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert to authenticated with check (user_id = auth.uid() and camotes_private.account_active() and camotes_private.visible_vehicle(vehicle_id));
create policy favorites_delete on public.favorites for delete to authenticated using (user_id = auth.uid());
create policy reviews_read on public.reviews for select to anon,authenticated using (not hidden or reviewer_id = auth.uid() or camotes_private.is_admin());
create policy reviews_insert on public.reviews for insert to authenticated with check (reviewer_id = auth.uid() and camotes_private.account_active() and not hidden and provider_reply is null);
create policy payouts_read on public.payouts for select to authenticated using (provider_id = auth.uid() or camotes_private.is_admin());
create policy reports_read on public.reports_disputes for select to authenticated using (reporter_id = auth.uid() or camotes_private.is_admin());
create policy reports_insert on public.reports_disputes for insert to authenticated with check (reporter_id = auth.uid() and camotes_private.account_active() and status = 'open' and assigned_admin_id is null and (booking_id is null or camotes_private.booking_participant(booking_id)) and (message_id is null or exists(select 1 from public.messages m where m.id = message_id and camotes_private.chat_access(m.conversation_id))));
create policy audit_admin_read on public.audit_logs for select to authenticated using (camotes_private.is_admin());

-- Deliberately restricted definer projection: public names/photos only, never
-- phone, DOB, auth metadata or document details. No writable view privileges.
create view public.provider_directory with (security_barrier = true) as
 select p.id,p.full_name,p.avatar_path from public.profiles p
 where p.account_status = 'active' and exists(select 1 from public.user_roles r
   where r.user_id = p.id and r.role in ('owner','driver') and r.status = 'active');
revoke all on public.provider_directory from anon,authenticated;
grant select on public.provider_directory to anon,authenticated,service_role;

-- Only participants of accepted bookings receive contact information.
create function public.get_booking_contacts(p_booking_id uuid)
returns table(user_id uuid,full_name text,phone text,avatar_path text)
language sql stable security definer set search_path = '' as $$
 select p.id,p.full_name,p.phone,p.avatar_path from public.bookings b join public.profiles p
 on p.id in (b.renter_id,b.owner_id,b.driver_id)
 where b.id = p_booking_id and b.status in ('confirmed','in_progress','completed','disputed')
 and camotes_private.booking_participant(b.id);
$$;
revoke all on function public.get_booking_contacts(uuid) from public,anon;
grant execute on function public.get_booking_contacts(uuid) to authenticated,service_role;

create function public.get_public_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('currency','PHP','timezone','Asia/Manila',
 'service_fee_bps',service_fee_bps,'cancellation_free_hours',cancellation_free_hours,
 'minimum_app_version',minimum_app_version,
 'chauffeur_enabled',chauffeur_enabled and tnc_status = 'active' and tnc_issued_on <= camotes_private.today_manila() and tnc_valid_until >= camotes_private.today_manila())
 from public.platform_settings where id;
$$;
revoke all on function public.get_public_settings() from public;
grant execute on function public.get_public_settings() to anon,authenticated,service_role;

-- Storage: public marketing assets; private verification and booking evidence.
-- Paths: avatars/<USER_UUID>/<random-file>;
-- vehicle-photos/<USER_UUID>/<VEHICLE_UUID>/<random-file>;
-- other buckets: <USER_UUID>/<random-file>. Use a new UUID filename per upload.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp']),
 ('vehicle-photos','vehicle-photos',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('verification-documents','verification-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('handover-photos','handover-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy camotes_upload_own_folder on storage.objects for insert to authenticated with check (
 camotes_private.account_active() and (storage.foldername(name))[1] = auth.uid()::text and (
   bucket_id in ('avatars','verification-documents','payment-proofs','handover-photos') or
   (bucket_id = 'vehicle-photos' and exists(select 1 from public.vehicles v
     where v.id::text = (storage.foldername(name))[2] and camotes_private.draft_vehicle(v.id)))
 ));
create policy camotes_read_own_objects on storage.objects for select to authenticated using (
 bucket_id in ('avatars','vehicle-photos','verification-documents','payment-proofs','handover-photos')
 and (storage.foldername(name))[1] = auth.uid()::text and camotes_private.account_active());
create policy camotes_admin_documents on storage.objects for select to authenticated using (
 bucket_id = 'verification-documents' and camotes_private.is_admin());
create policy camotes_booking_evidence on storage.objects for select to authenticated using (
 (bucket_id = 'payment-proofs' and exists(select 1 from public.payments p where p.proof_path = name and (camotes_private.booking_participant(p.booking_id) or camotes_private.is_admin()))) or
 (bucket_id = 'handover-photos' and exists(select 1 from public.handovers h where name = any(h.photo_paths) and (camotes_private.booking_participant(h.booking_id) or camotes_private.dispute_admin(h.booking_id))))
 );
-- No client UPDATE/DELETE policies for evidence: an approved document cannot be
-- replaced in place. A trusted upload/deletion workflow cleans orphaned objects.

-- Maintenance is callable ONLY by the trusted server. Schedule this via Supabase
-- Cron after installation, e.g. every 5 minutes; scheduling is not installed here.
create function public.run_camotes_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
 update public.platform_settings set chauffeur_enabled = false,
   tnc_status = case when tnc_status = 'active' and tnc_valid_until < camotes_private.today_manila() then 'expired' else tnc_status end
 where id and chauffeur_enabled and (tnc_status <> 'active' or tnc_valid_until < camotes_private.today_manila());
 update public.documents set status = 'expired'
 where status = 'approved' and (expires_on < camotes_private.today_manila() or next_reverification_on < camotes_private.today_manila());
 update public.bookings set status = 'expired'
 where status in ('pending_owner','pending_driver') and response_due_at <= now();
 insert into public.notifications(user_id,mode,kind,title,body,deduplication_key)
 select d.user_id,case when d.vehicle_id is not null or d.document_type in ('business_permit','dti_sec_registration') then 'owner'
   when d.document_type in ('professional_license','nbi_clearance','pnp_clearance') then 'driver' else 'renter' end,
   'document_expiry','A document needs your attention','Open verification to review an upcoming expiry.',
   'doc:'||d.id::text||':'||d.expires_on::text||':'||r.days::text
 from public.documents d cross join public.platform_settings s cross join lateral unnest(s.expiry_reminder_days) as r(days)
 where d.status = 'approved' and d.expires_on = camotes_private.today_manila()+r.days
 on conflict(deduplication_key) do nothing;
 insert into public.notifications(user_id,mode,kind,title,body,deduplication_key)
 select a.user_id,'admin','tnc_expiry','Platform accreditation needs attention',
   'Review the platform accreditation before it expires.',
   'tnc:'||s.tnc_valid_until::text||':'||r.days::text||':'||a.user_id::text
 from public.user_roles a cross join public.platform_settings s
 cross join lateral unnest(s.expiry_reminder_days) as r(days)
 where a.role = 'admin' and a.status = 'active' and s.tnc_status = 'active'
   and s.tnc_valid_until = camotes_private.today_manila()+r.days
 on conflict(deduplication_key) do nothing;
 insert into public.notifications(user_id,mode,kind,title,body,booking_id,deduplication_key)
 select a.user_id,'admin','compliance_review','A confirmed trip needs review',
   'Recheck eligibility before pickup.',b.id,'eligibility:'||b.id::text||':'||a.user_id::text
 from public.bookings b cross join public.user_roles a
 where a.role = 'admin' and a.status = 'active' and b.status = 'confirmed'
 and (exists(select 1 from public.documents d where d.status = 'expired' and (d.vehicle_id = b.vehicle_id or d.user_id in (b.renter_id,b.owner_id,b.driver_id)))
      or (b.service_type = 'chauffeured' and not exists(select 1 from public.platform_settings where id and chauffeur_enabled and tnc_status = 'active' and tnc_valid_until >= (b.ends_at at time zone 'Asia/Manila')::date)))
 on conflict(deduplication_key) do nothing;
end $$;
revoke all on function public.run_camotes_maintenance() from public,anon,authenticated;
grant execute on function public.run_camotes_maintenance() to service_role;

-- Remove default PUBLIC execution on all internal helpers. Public read policies
-- need explicit anon execution only for safe boolean access helpers.
revoke all on all functions in schema camotes_private from public,anon,authenticated;
grant execute on all functions in schema camotes_private to service_role;
grant execute on function camotes_private.account_active(),camotes_private.has_role(text),
 camotes_private.is_admin(),camotes_private.owns_vehicle(uuid),camotes_private.draft_vehicle(uuid),
 camotes_private.visible_vehicle(uuid),camotes_private.booking_participant(uuid),
 camotes_private.dispute_admin(uuid),camotes_private.chat_access(uuid),camotes_private.can_message(uuid) to authenticated;
grant usage on schema camotes_private to anon;
grant execute on function camotes_private.account_active(),camotes_private.has_role(text),
 camotes_private.is_admin(),camotes_private.owns_vehicle(uuid),camotes_private.visible_vehicle(uuid) to anon;

commit;

-- AFTER INSTALLATION (run separately, intentionally commented out):
-- 1. Sign up your real admin account using Supabase Auth, then replace the UUID:
-- insert into public.user_roles(user_id,role,status,verified_at)
-- values ('REPLACE_WITH_AUTH_USER_UUID'::uuid,'admin','active',now());
-- 2. Enroll/challenge MFA; admin RLS reads require JWT aal2.
-- 3. Build authorized Edge Functions for listing submission/revisions, approvals,
--    availability writes, booking creation/transitions, payments, payouts,
--    document review, review replies/moderation, signed URLs and account deletion.
--    Pass through the acting user's JWT where possible. A service-role request
--    has no auth.uid(): propagate a verified actor through a future audited RPC
--    rather than trusting an actor ID from client JSON. Existing audit actor_id
--    is null for service-only operations; database_role still records that fact.
-- 4. Before inserting a booking, supply renter_id, vehicle_id, service_type,
--    driver_id (chauffeured only), dates, pickup/return IDs or addresses and town.
--    Price/owner/snapshot NOT NULL columns are filled by the BEFORE trigger.
-- 5. On provider acceptance, set owner_accepted_at / driver_accepted_at and status
--    atomically. Record confirmed payment events before confirming an advance-
--    required booking. Payment/deposit rollups/refunds need server transactions.
-- 6. Enable Supabase Cron and schedule select public.run_camotes_maintenance();
--    Eligibility checks also run on request/confirmation/start without Cron.
-- 7. Realtime publication, push/email delivery, retention jobs and storage cleanup
--    are intentionally not enabled by this schema. Configure only after testing.
-- 8. Account deletion must anonymize retained profiles/financial records and remove
--    private files/device tokens through trusted code before deleting auth users.
-- 9. No production users, listings, payments or fake accreditation are seeded.
