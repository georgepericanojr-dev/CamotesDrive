import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const db = new PGlite({ extensions: { btree_gist } });
const sql = readFileSync('supabase_dbschema.md', 'utf8');
let passed = 0;
const check = (name, condition = true) => { assert.ok(condition, name); passed++; console.log(`PASS ${name}`); };
const one = async q => (await db.query(q)).rows[0];
async function deny(name, q, code) { try { await db.exec(q); throw new Error(`Unexpectedly allowed: ${name}`); } catch (e) { if (e.message.startsWith('Unexpectedly')) throw e; if(code) assert.equal(e.code, code, name); check(name); } }
async function asUser(id, aal = 'aal1', role = 'authenticated') { await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claims','${JSON.stringify({ sub: id, aal, role })}',false);`); }
async function root() { await db.exec(`reset role; select set_config('request.jwt.claims','{}',false);`); }
try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
    insert into auth.users(id) values('00000000-0000-0000-0000-000000000099');
  `);
  try { await db.exec(sql); } catch(e) { console.error('INSTALL ERROR', e.message, e.detail || '', 'line', sql.slice(0,Number(e.position || 0)).split('\n').length); throw e; }
  check('entire SQL installation executes'); await db.exec(readFileSync('supabase/migrations/202610150001_api.sql','utf8')); check('API migration executes');
  check('preexisting auth user receives renter profile', (await one(`select count(*)::int n from public.user_roles where user_id='00000000-0000-0000-0000-000000000099' and role='renter' and status='active'`)).n === 1);
  const rls = await one(`select count(*)::int n,count(*) filter(where relrowsecurity)::int secured from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relkind='r'`);
  check('every application table has RLS', rls.n === rls.secured);
  console.log('Application tables:', rls.n);
  const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
  const [renter, owner, driver, stranger, admin] = [1,2,3,4,5].map(uid);
  const profileNames = new Map([[renter,'Alex Renter'],[owner,'Bea Owner'],[driver,'Chris Driver'],[stranger,'Dina Stranger'],[admin,'Eli Admin']]);
  for (const [id, full_name] of profileNames) await db.exec(`insert into auth.users(id,email_confirmed_at,raw_user_meta_data) values('${id}',now(),'${JSON.stringify({ full_name,role:'admin' })}'); update public.profiles set date_of_birth=current_date-interval '30 years',phone='+639170000000',terms_accepted_at=now(),privacy_accepted_at=now() where id='${id}';`);
  check('signup metadata cannot self-assign admin', (await one(`select count(*)::int n from public.user_roles where role='admin'`)).n === 0);
  await db.exec(`insert into public.user_roles(user_id,role,status) values('${admin}','admin','active');`);
  await asUser(admin);
  check('fresh schema allows active authenticated admin without MFA',(await one('select camotes_private.is_admin() allowed')).allowed);
  await root();
  // Emulate an existing deployment before the MFA-removal migration. This also
  // proves the migration upgrades deployed RPC definitions, not only new installs.
  await db.exec(`create or replace function camotes_private.is_admin() returns boolean
    language sql stable security definer set search_path = '' as $$
    select camotes_private.has_role('admin') and coalesce(auth.jwt()->>'aal','') = 'aal2'; $$;`);
  for (const signature of ['public.camotes_read(text,jsonb)','public.camotes_mutate(text,jsonb)']) {
    const definition=(await one(`select pg_get_functiondef('${signature}'::regprocedure) definition`)).definition;
    await db.exec(definition.replaceAll('Active admin role required','Admin role and MFA required').replaceAll('Active owner or admin role required','Owner or MFA admin required'));
  }
  await asUser(admin);
  check('legacy admin helper blocks aal1 before upgrade',!(await one('select camotes_private.is_admin() allowed')).allowed);
  await deny('legacy RPC blocks admin aal1 before upgrade',`select public.camotes_read('admin','{"section":"users"}')`,'42501');
  await root();
  const removeAdminMfaSql=readFileSync('supabase/migrations/202610150002_remove_admin_mfa.sql','utf8');
  await db.exec(removeAdminMfaSql);check('MFA removal migration upgrades existing installation');
  const adminRoleNamesSql=readFileSync('supabase/migrations/202610150003_admin_role_names.sql','utf8').replaceAll('\r\n','\n');
  const adminRoleNamesCrlfSql=adminRoleNamesSql.replaceAll('\n','\r\n');
  await db.exec(adminRoleNamesCrlfSql);check('admin role names migration upgrades existing installation');
  const installedRoleReadDefinition=(await one(`select pg_get_functiondef('public.camotes_read(text,jsonb)'::regprocedure) definition`)).definition;
  await db.exec(adminRoleNamesSql);await db.exec(adminRoleNamesCrlfSql);await db.exec(adminRoleNamesSql);
  assert.equal((await one(`select pg_get_functiondef('public.camotes_read(text,jsonb)'::regprocedure) definition`)).definition,installedRoleReadDefinition);
  check('role names migration supports LF and CRLF reapplication without rewriting the installed function');
  for (const signature of ['public.camotes_read(text,jsonb)','public.camotes_mutate(text,jsonb)']) {
    const definition=(await one(`select pg_get_functiondef('${signature}'::regprocedure) definition`)).definition;
    check(`${signature} legacy MFA error messages are updated`,!definition.includes('Admin role and MFA required')&&!definition.includes('Owner or MFA admin required'));
  }
  await asUser(admin);
  check('upgraded admin helper allows aal1',(await one('select camotes_private.is_admin() allowed')).allowed);
  check('upgraded admin RPC allows aal1',Array.isArray((await one(`select public.camotes_read('admin','{"section":"users"}') value`)).value));
  check('upgraded admin can perform an admin mutation at aal1',(await one(`select public.camotes_mutate('admin.settings.update','{}')->>'currency' currency`)).currency==='PHP');
  check('upgraded admin RLS exposes other profiles',(await one('select count(*)::int n from public.profiles')).n>1);
  const namedRoleRows=(await one(`select public.camotes_read('admin','{"section":"roles","limit":50}') value`)).value;
  const storedRoleRows=(await db.query('select * from public.user_roles')).rows;
  check('admin role records preserve every user UUID and role',namedRoleRows.length===storedRoleRows.length&&storedRoleRows.every(stored=>namedRoleRows.some(row=>row.user_id===stored.user_id&&row.role===stored.role&&row.status===stored.status)));
  check('admin role records join the correct full name for every profile',namedRoleRows.every(row=>row.full_name===(profileNames.get(row.user_id)??null)&&row.account_status==='active'));
  check('blank profile names remain absent instead of exposing a fabricated name',namedRoleRows.find(row=>row.user_id===uid(99)).full_name===null);
  const rolePage=(await one(`select public.camotes_read('admin','{"section":"roles","limit":2,"offset":1}') value`)).value;
  assert.deepEqual(rolePage,namedRoleRows.slice(1,3));check('enriched role records preserve stable server pagination');
  check('role pagination past the last record is empty',(await one(`select public.camotes_read('admin','{"section":"roles","offset":100}') value`)).value.length===0);
  await asUser(stranger,'aal2');
  await deny('MFA alone never grants admin read access',`select public.camotes_read('admin','{"section":"users"}')`,'42501');
  await deny('ordinary users cannot read full names through admin role records',`select public.camotes_read('admin','{"section":"roles"}')`,'42501');
  await deny('MFA alone never grants admin mutation access',`select public.camotes_mutate('admin.settings.update','{}')`,'42501');
  for (const status of ['pending','rejected','suspended']) {
    await root();await db.exec(`update public.user_roles set status='${status}' where user_id='${admin}' and role='admin'`);
    await asUser(admin,'aal2');
    check(`${status} admin role fails helper`,!(await one('select camotes_private.is_admin() allowed')).allowed);
    await deny(`${status} admin role cannot read admin RPC`, `select public.camotes_read('admin','{"section":"users"}')`,'42501');
  }
  await root();await db.exec(`update public.user_roles set status='active' where user_id='${admin}' and role='admin'; update public.profiles set account_status='suspended' where id='${admin}';`);
  await asUser(admin,'aal2');
  check('suspended admin account fails helper',!(await one('select camotes_private.is_admin() allowed')).allowed);
  await deny('suspended admin account cannot read admin RPC',`select public.camotes_read('admin','{"section":"users"}')`,'42501');
  await deny('suspended admin account cannot mutate admin RPC',`select public.camotes_mutate('admin.settings.update','{}')`,'42501');
  await root();await db.exec(`update public.profiles set account_status='active' where id='${admin}'`);
  await asUser(admin,'aal2','anon');
  await deny('anonymous claim cannot use a real admin identity',`select public.camotes_read('admin','{"section":"users"}')`,'42501');
  await deny('anonymous sessions cannot read enriched admin role records',`select public.camotes_read('admin','{"section":"roles"}')`,'42501');
  await root();
  async function doc(user, type, vehicle = null, plate='TEST 123') { const vehicleVal=vehicle ? `'${vehicle}'` : 'null'; await db.exec(`insert into public.documents(user_id,vehicle_id,document_type,storage_path,reference_number,plate_number,issued_on,expires_on,license_kind,reviewed_vehicle_classes,next_reverification_on,consent_given_at,status,reviewed_by,reviewed_at) values('${user}',${vehicleVal},'${type}','${user}/${type}/${vehicle || 'personal'}','CASE-001','${plate}',current_date-1,current_date+365,'professional',array['car','suv','van','motorcycle'],current_date+365,now(),'approved','${admin}',now());`); }
  for(const [user, types] of [[owner,['government_id']],[renter,['government_id','drivers_license']],[driver,['government_id','professional_license','nbi_clearance','pnp_clearance']]]) for(const type of types) await doc(user,type);
  await db.exec(`insert into public.driver_profiles(user_id,verification_status,available_for_hire,daily_fee_centavos,service_areas) values('${driver}','approved',true,120000,array['San Francisco']); insert into public.user_roles(user_id,role,status,verified_by,verified_at) values('${owner}','owner','active','${admin}',now()),('${driver}','driver','active','${admin}',now());`);
  const vehicle = uid(10);
  await db.exec(`insert into public.vehicles(id,owner_id,name,vehicle_type,make,model,year,plate_number,seats,transmission,fuel_type,pickup_town,daily_rate_centavos,deposit_centavos) values('${vehicle}','${owner}','Toyota Test','car','Toyota','Test',2024,'TEST 123',5,'automatic','gasoline','San Francisco',150000,300000);`);
  await doc(owner,'or_cr',vehicle); await doc(owner,'ctpl_insurance',vehicle);
  await db.exec(`update public.vehicles set status='approved',reviewed_by='${admin}',reviewed_at=now() where id='${vehicle}';`);
  async function booking(id, suppliedDriver = 'null', service = 'self_drive') { return db.exec(`insert into public.bookings(id,renter_id,vehicle_id,service_type,driver_id,starts_at,ends_at,pickup_address,return_address,pickup_town) values('${id}','${renter}','${vehicle}','${service}',${suppliedDriver},now()+interval '10 days',now()+interval '12 days','Consuelo','Consuelo','San Francisco');`); }
  const b1=uid(20), b2=uid(21);
  await booking(b1);
  const price = await one(`select total_centavos::text total,rental_days,owner_id from public.bookings where id='${b1}'`);
  check('server calculates two-day PHP price + 5% fee', price.total === '315000' && price.rental_days === 2 && price.owner_id === owner);
  check('booking automatically creates conversation/history', (await one(`select count(*)::int n from public.conversations where booking_id='${b1}'`)).n === 1 && (await one(`select count(*)::int n from public.booking_events where booking_id='${b1}'`)).n === 1);
  await db.exec(`update public.bookings set status='confirmed',owner_accepted_at=now() where id='${b1}';`);
  await booking(b2);
  await deny('overlapping vehicle confirmation is rejected', `update public.bookings set status='confirmed',owner_accepted_at=now() where id='${b2}'`, '23P01');
  await deny('immutable booking price cannot be changed',`update public.bookings set vehicle_rate_centavos=1 where id='${b1}'`);
  await deny('invalid state transition is rejected',`update public.bookings set status='completed' where id='${b1}'`);
  await deny('calendar block cannot overlap confirmed rental',`insert into public.vehicle_availability(vehicle_id,starts_at,ends_at) values('${vehicle}',now()+interval '10 days',now()+interval '11 days')`);
  await deny('self-drive cannot contain hired driver', `insert into public.bookings(renter_id,vehicle_id,service_type,driver_id,starts_at,ends_at,pickup_address,return_address,pickup_town) values('${renter}','${vehicle}','self_drive','${driver}',now()+interval '20 days',now()+interval '21 days','a','a','San Francisco')`);
  await deny('chauffeur request blocked before accreditation',`insert into public.bookings(renter_id,vehicle_id,service_type,driver_id,starts_at,ends_at,pickup_address,return_address,pickup_town) values('${renter}','${vehicle}','chauffeured','${driver}',now()+interval '20 days',now()+interval '21 days','a','a','San Francisco')`);
  await deny('incomplete TNC record cannot enable service',`update public.platform_settings set chauffeur_enabled=true,tnc_status='active',tnc_number='TEST',tnc_issued_on=current_date where id`);
  await asUser(stranger);
  check('unrelated renter cannot see booking', (await one(`select count(*)::int n from public.bookings`)).n === 0);
  check('private profiles are not globally readable', (await one(`select count(*)::int n from public.profiles`)).n === 1);
  await deny('client cannot directly create booking',`insert into public.bookings(renter_id) values('${stranger}')`);
  await deny('client cannot activate provider/admin role',`update public.user_roles set status='active' where user_id='${stranger}'`);
  await deny('client cannot approve own documents',`update public.documents set status='approved' where user_id='${stranger}'`);
  await deny('client cannot edit verified birth date',`update public.profiles set date_of_birth=current_date-interval '30 years' where id='${stranger}'`);
  await deny('client cannot edit payment status',`update public.bookings set payment_status='paid' where id='${b1}'`);
  await deny('vehicle plate not exposed by listing grants',`select plate_number from public.vehicles`);
  check('unrelated account receives no contacts', (await db.query(`select * from public.get_booking_contacts('${b1}')`)).rows.length === 0);
  await asUser(renter);
  check('confirmed participant receives booking contacts',(await db.query(`select * from public.get_booking_contacts('${b1}')`)).rows.length === 2);
  await db.exec(`insert into public.user_roles(user_id,role) values('${renter}','owner');`);
  check('provider request starts pending',(await one(`select status from public.user_roles where user_id='${renter}' and role='owner'`)).status === 'pending');
  await deny('client cannot self-assign admin via role insert',`insert into public.user_roles(user_id,role) values('${renter}','admin')`);
  const conversation = (await one(`select id from public.conversations where booking_id='${b1}'`)).id;
  await db.exec(`insert into public.messages(conversation_id,sender_id,body,client_message_id) values('${conversation}','${renter}','Hello',gen_random_uuid());`);
  check('booking participant can send message');
  await asUser(stranger);
  await deny('outsider cannot send booking message',`insert into public.messages(conversation_id,sender_id,body,client_message_id) values('${conversation}','${stranger}','Hello',gen_random_uuid())`);
  await asUser(admin);
  check('active admin without MFA can view private documents',(await one(`select count(*)::int n from public.documents`)).n > 0);
  await asUser(admin,'aal2');
  check('existing aal2 admin sessions still work',(await one(`select count(*)::int n from public.documents`)).n > 0);
  check('admin cannot browse unrelated booking chat',(await one(`select count(*)::int n from public.messages`)).n === 0);
  await root();
  await db.exec(`insert into public.reports_disputes(reporter_id,booking_id,category,description,assigned_admin_id) values('${renter}','${b1}','other','Review this chat','${admin}');`);
  await asUser(admin);
  check('assigned dispute admin may read reported booking chat',(await one(`select count(*)::int n from public.messages`)).n === 1);
  await root();
  await deny('nonprofessional license cannot be approved as professional', `insert into public.documents(user_id,document_type,storage_path,issued_on,expires_on,license_kind,reviewed_vehicle_classes,next_reverification_on,consent_given_at,status,reviewed_by,reviewed_at) values('${stranger}','professional_license','${stranger}/fake',current_date-1,current_date+365,'non_professional',array['car'],current_date+365,now(),'approved','${admin}',now())`, '23514');
  const secondVehicle=uid(11);
  await db.exec(`update public.vehicles set service_type='both',ltfrb_case_number='CASE-001',ltfrb_valid_until=current_date+365 where id='${vehicle}';`);
  await doc(owner,'ltfrb_authority',vehicle); await doc(owner,'passenger_insurance',vehicle);
  await db.exec(`update public.vehicles set status='approved',with_driver_eligible=true,reviewed_by='${admin}',reviewed_at=now() where id='${vehicle}';
    insert into public.vehicles(id,owner_id,name,vehicle_type,make,model,year,plate_number,seats,transmission,fuel_type,pickup_town,daily_rate_centavos,service_type,ltfrb_case_number,ltfrb_valid_until) values('${secondVehicle}','${owner}','Second car','car','Toyota','Test',2024,'TEST 124',5,'automatic','gasoline','San Francisco',150000,'both','CASE-001',current_date+365);`);
  for(const type of ['or_cr','ctpl_insurance','ltfrb_authority','passenger_insurance']) await doc(owner,type,secondVehicle,'TEST 124');
  await db.exec(`update public.vehicles set status='approved',with_driver_eligible=true,reviewed_by='${admin}',reviewed_at=now() where id='${secondVehicle}'; update public.platform_settings set chauffeur_enabled=true,tnc_status='active',tnc_number='TEST',tnc_issued_on=current_date-1,tnc_valid_until=current_date+365 where id;`);
  const b3=uid(22),b4=uid(23);
  for(const [id,vid] of [[b3,vehicle],[b4,secondVehicle]]) await db.exec(`insert into public.bookings(id,renter_id,vehicle_id,service_type,driver_id,starts_at,ends_at,pickup_address,return_address,pickup_town) values('${id}','${renter}','${vid}','chauffeured','${driver}',now()+interval '20 days',now()+interval '22 days','a','a','San Francisco'); update public.bookings set status='pending_driver',owner_accepted_at=now() where id='${id}';`);
  await db.exec(`update public.bookings set status='confirmed',driver_accepted_at=now(),driver_trip_status='accepted' where id='${b3}';`);
  check('accredited eligible chauffeur request can be confirmed',(await one(`select total_centavos::text total from public.bookings where id='${b3}'`)).total === '567000');
  await deny('same driver cannot overlap across different vehicles',`update public.bookings set status='confirmed',driver_accepted_at=now() where id='${b4}'`,'23P01');
  await db.exec(`update public.bookings set driver_trip_status='en_route' where id='${b3}';`);
  check('driver en-route status is captured in booking history',(await one(`select count(*)::int n from public.booking_events where booking_id='${b3}' and new_values->>'driver_trip_status'='en_route'`)).n === 1);
  await asUser(stranger,'aal1','anon');
  check('anonymous browse sees approved listings',(await one(`select count(*)::int n from public.vehicles`)).n === 2);
  check('anonymous settings RPC works',(await one(`select public.get_public_settings()->>'currency' c`)).c === 'PHP');
  await deny('anonymous cannot read private profiles',`select * from public.profiles`,'42501');
  await asUser(renter);
  await deny('private upload outside own folder is rejected',`insert into storage.objects(bucket_id,name) values('verification-documents','${owner}/not-mine.pdf')`,'42501');
  await db.exec(`insert into storage.objects(bucket_id,name) values('verification-documents','${renter}/sample.pdf');`); check('private upload into own folder succeeds');
  await deny('confirmed future rental cannot be reviewed early',`insert into public.reviews(booking_id,reviewer_id,target_type,vehicle_id,rating) values('${b1}','${renter}','vehicle','${vehicle}',5)`);
  await root();
  await db.exec(`update public.bookings set status='in_progress' where id='${b1}'; update public.bookings set status='completed' where id='${b1}'; insert into public.notifications(user_id,kind,title,body) values('${renter}','test','Test','Test');`);
  await asUser(renter);
  await db.exec(`insert into public.reviews(booking_id,reviewer_id,target_type,vehicle_id,rating) values('${b1}','${renter}','vehicle','${vehicle}',5); update public.notifications set read_at=now() where user_id='${renter}';`);
  check('completed booking review and notification read-state succeed');
  await deny('duplicate review is rejected',`insert into public.reviews(booking_id,reviewer_id,target_type,vehicle_id,rating) values('${b1}','${renter}','vehicle','${vehicle}',4)`,'23505');
  await root(); await db.exec(`select public.run_camotes_maintenance();`); check('maintenance job executes');

  async function mutateAction(action,payload={}){return (await db.query('select public.camotes_mutate($1,$2::jsonb) value',[action,JSON.stringify(payload)])).rows[0].value;}
  async function readAction(resource,params={}){return (await db.query('select public.camotes_read($1,$2::jsonb) value',[resource,JSON.stringify(params)])).rows[0].value;}
  await asUser(stranger,'aal1','anon');
  check('RPC public catalog excludes plate',(await readAction('vehicles')).every(v=>!('plate_number' in v)));
  await deny('RPC private reads reject anonymous',"select public.camotes_read('me')",'42501');
  await asUser(renter);
  await mutateAction('profile.update',{full_name:'Updated renter',phone:'+639171234567',accept_terms:true,date_of_birth:'1990-01-01'});
  const me=await readAction('me');check('RPC ignores protected DOB while saving profile',me.profile.full_name==='Updated renter'&&me.profile.date_of_birth!=='1990-01-01');
  await deny('RPC cannot activate unverified provider mode',"select public.camotes_mutate('profile.mode','{\"mode\":\"owner\"}')",'42501');
  await deny('RPC admin action rejects renter',"select public.camotes_mutate('admin.user.status','{}')",'42501');
  const clock=Date.now();const start=new Date(clock+40*86400000).toISOString(),end=new Date(clock+42*86400000).toISOString();
  const input={vehicle_id:vehicle,starts_at:start,ends_at:end,pickup_address:'Consuelo',return_address:'Consuelo',pickup_town:'San Francisco',payment_method:'gcash'};
  const quote=await mutateAction('booking.quote',input);check('RPC quote uses server prices',Number(quote.total_centavos)===315000);
  await deny('RPC rejects inactive or missing pickup location',"select public.camotes_mutate('booking.quote','"+JSON.stringify({...input,pickup_location_id:uid(999)})+"')");
  const request={...input,request_id:uid(40),accept_terms:true,expected_total_centavos:quote.total_centavos};
  const requested=await mutateAction('booking.request',request);check('RPC derives renter/owner identity',requested.renter_id===renter&&requested.owner_id===owner&&requested.status==='pending_owner');
  check('RPC booking retry is idempotent',(await mutateAction('booking.request',request)).id===requested.id);
  await deny('RPC rejects repriced request before commit',"select public.camotes_mutate('booking.request','"+JSON.stringify({...request,request_id:uid(41),expected_total_centavos:1})+"')");
  await asUser(stranger);
  await deny('RPC outsider cannot accept booking',"select public.camotes_mutate('booking.accept','"+JSON.stringify({id:requested.id})+"')",'42501');
  await asUser(owner);
  await mutateAction('booking.accept',{id:requested.id});check('RPC owner acceptance confirms self-drive',(await readAction('booking',{id:requested.id})).status==='confirmed');
  await asUser(renter);check('RPC retry after confirmation returns same booking',(await mutateAction('booking.request',request)).id===requested.id);
  const payment=await mutateAction('payment.submit',{booking_id:requested.id,event_type:'rental',method:'gcash',reference_number:'REF-1',request_id:uid(42)});check('RPC derives payment amount',Number(payment.amount_centavos)===315000);
  await asUser(renter);await deny('RPC renter cannot confirm their payment',"select public.camotes_mutate('payment.confirm','"+JSON.stringify({id:payment.id})+"')",'42501');
  await asUser(owner);await mutateAction('payment.confirm',{id:payment.id});check('RPC payment confirmation updates booking atomically',(await readAction('booking',{id:requested.id})).payment_status==='paid');
  await asUser(renter);check('RPC confirmed payment retry returns same receipt',(await mutateAction('payment.submit',{booking_id:requested.id,event_type:'rental',method:'gcash',reference_number:'REF-1',request_id:uid(42)})).id===payment.id);
  check('RPC upcoming trips include confirmed reservation',(await readAction('bookings',{mode:'renter',status_group:'upcoming'})).some(b=>b.id===requested.id));
  check('RPC past trips exclude confirmed reservation',!(await readAction('bookings',{mode:'renter',status_group:'past'})).some(b=>b.id===requested.id));
  await asUser(owner);
  await deny('RPC owner cannot start without condition evidence',"select public.camotes_mutate('booking.start','"+JSON.stringify({id:requested.id})+"')");
  await root();await db.exec("insert into storage.objects(bucket_id,name) values('handover-photos','"+owner+"/pickup.jpg'),('handover-photos','"+owner+"/return.jpg')");
  await asUser(owner);await mutateAction('handover.save',{id:requested.id,phase:'pickup',photo_paths:[owner+'/pickup.jpg'],notes:'Good condition'});
  await mutateAction('booking.start',{id:requested.id});check('RPC pickup evidence unlocks start',(await readAction('booking',{id:requested.id})).status==='in_progress');
  await mutateAction('handover.save',{id:requested.id,phase:'return',photo_paths:[owner+'/return.jpg'],notes:'Returned'});await mutateAction('booking.complete',{id:requested.id});check('RPC return evidence unlocks completion',(await readAction('booking',{id:requested.id})).status==='completed');
  await asUser(renter);await mutateAction('review.submit',{booking_id:requested.id,rating:5,comment:'Great',target_type:'vehicle'});check('RPC publishes eligible review');
  await asUser(owner);const future=new Date(Date.now()+60*86400000);const futureMonth=future.toISOString().slice(0,7);const futureDay=futureMonth+'-20';
  await mutateAction('availability.save',{vehicle_id:secondVehicle,month:futureMonth+'-01',days:[futureDay],reason:'Maintenance'});check('RPC calendar writes correct owned vehicle',(await readAction('availability',{vehicle_id:secondVehicle})).length===1);
  await asUser(stranger);await deny('RPC rejects another owner calendar',"select public.camotes_mutate('availability.save','"+JSON.stringify({vehicle_id:secondVehicle,month:futureMonth+'-01',days:[]})+"')",'42501');
  await asUser(admin);check('RPC admin read works without MFA',Array.isArray(await readAction('admin',{section:'users'})));
  const requestedOwnerRole=(await readAction('admin',{section:'roles',limit:50})).find(row=>row.user_id===renter&&row.role==='owner');
  check('admin role records reflect current full names after profile edits',requestedOwnerRole.full_name==='Updated renter');
  const reviewedRole=await mutateAction('admin.role.review',{user_id:requestedOwnerRole.user_id,role:requestedOwnerRole.role,decision:'rejected',reason:'Additional evidence required'});
  const storedReviewedRole=await one(`select status,verified_by from public.user_roles where user_id='${renter}' and role='owner'`);
  check('admin role review still targets the immutable UUID from a named record',reviewedRole.user_id===renter&&storedReviewedRole.status==='rejected'&&storedReviewedRole.verified_by===admin&&(await one(`select status from public.user_roles where user_id='${owner}' and role='owner'`)).status==='active');
  const refund=await mutateAction('payment.settle',{booking_id:requested.id,event_type:'refund',amount_centavos:100000,method:'bank_transfer',reference_number:'REFUND-1',reason:'Agreed adjustment',request_id:uid(43)});check('RPC manual refund is recorded',refund.status==='confirmed'&&(await readAction('booking',{id:requested.id})).payment_status==='partially_refunded');
  await deny('RPC prevents over-refund',"select public.camotes_mutate('payment.settle','"+JSON.stringify({booking_id:requested.id,event_type:'refund',amount_centavos:99999999,method:'cash',reason:'Test',request_id:uid(44)})+"')");
  await root();await db.exec(readFileSync('supabase/migrations/202610150001_api.sql','utf8'));check('API migration can be reapplied without data loss');
  await db.exec(removeAdminMfaSql);await db.exec(removeAdminMfaSql);
  await db.exec(adminRoleNamesCrlfSql);await db.exec(adminRoleNamesSql);await db.exec(adminRoleNamesCrlfSql);await db.exec(adminRoleNamesSql);
  check('MFA removal migration can be reapplied without deleting bookings',(await one(`select count(*)::int n from public.bookings where id='${requested.id}'`)).n===1);
  await asUser(admin);check('reapplied migration keeps admin access at aal1',Array.isArray(await readAction('admin',{section:'users'})));
  check('reapplied role names migration preserves joined names and existing role decisions',(await readAction('admin',{section:'roles',limit:50})).some(row=>row.user_id===renter&&row.role==='owner'&&row.full_name==='Updated renter'&&row.status==='rejected'));


  await root();
  const reviewMigration=readFileSync('supabase/migrations/202610150004_document_review_fields.sql','utf8');
  await db.exec(reviewMigration);await db.exec(reviewMigration.replaceAll('\r\n','\n'));
  check('document review migration installs and reapplies safely');
  const reviewTypes=['government_id','business_permit','or_cr','ctpl_insurance','professional_license','pnp_clearance'];
  for(let i=0;i<reviewTypes.length;i++) {
    const type=reviewTypes[i],id=uid(2000+i),vehicleId=['or_cr','ctpl_insurance'].includes(type)?vehicle:null,path=owner+'/review-'+type;
    await db.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['verification-documents',path,owner]);
    await db.query('insert into public.documents(id,user_id,vehicle_id,document_type,storage_path,issued_on,expires_on,consent_given_at) values($1,$2,$3,$4,$5,current_date-1,current_date+365,now())',[id,owner,vehicleId,type,path]);
  }
  await asUser(stranger);
  await deny('ordinary account cannot approve review details',`select public.camotes_mutate('admin.document.review','{"id":"${uid(2001)}","decision":"approved","review_details":{"business_name":"Injected"}}')`,'42501');
  await deny('ordinary account cannot write review metadata directly',`update public.documents set review_details='{}' where id='${uid(2001)}'`,'42501');
  await asUser(admin);
  await deny('government ID rejects vehicle plate fields',`select public.camotes_mutate('admin.document.review','{"id":"${uid(2000)}","decision":"approved","plate_number":"WRONG"}')`);
  await deny('government ID rejects license class fields',`select public.camotes_mutate('admin.document.review','{"id":"${uid(2000)}","decision":"approved","vehicle_classes":["car"]}')`);
  await deny('government ID rejects insurance metadata',`select public.camotes_mutate('admin.document.review','{"id":"${uid(2000)}","decision":"approved","review_details":{"insurer":"Wrong"}}')`);
  await mutateAction('admin.document.review',{id:uid(2000),decision:'approved',reference_number:'ID-001',expires_on:null});
  const reviewedId=await one(`select status,expires_on,reviewed_by from public.documents where id='${uid(2000)}'`);
  check('ID review clears optional expiry and records explicit approval',reviewedId.status==='approved'&&reviewedId.expires_on===null&&reviewedId.reviewed_by===admin);
  await mutateAction('admin.document.review',{id:uid(2001),decision:'approved',reference_number:'PERMIT-1',review_details:{business_name:'Island Business',issuing_authority:'San Francisco LGU'}});
  check('business details survive API review',(await one(`select review_details from public.documents where id='${uid(2001)}'`)).review_details.business_name==='Island Business');
  check('review details changes have an admin audit trail',(await one(`select count(*)::int n from public.audit_logs where record_id='${uid(2001)}' and actor_id='${admin}' and 'review_details'=any(changed_fields)`)).n>0);
  await mutateAction('admin.document.review',{id:uid(2002),decision:'approved',plate_number:'TEST 123',review_details:{or_number:'OR-1',cr_number:'CR-1'}});
  check('OR and CR numbers persist separately',(await one(`select review_details from public.documents where id='${uid(2002)}'`)).review_details.cr_number==='CR-1');
  await deny('insurance cannot clear a policy-required expiry',`select public.camotes_mutate('admin.document.review','{"id":"${uid(2003)}","decision":"approved","expires_on":null}')`);
  await deny('insurance rejects identity birth dates',`select public.camotes_mutate('admin.document.review','{"id":"${uid(2003)}","decision":"approved","verified_date_of_birth":"1990-01-01"}')`);
  await deny('professional driving license retains explicit classification gate',`select public.camotes_mutate('admin.document.review','{"id":"${uid(2004)}","decision":"approved","vehicle_classes":["car"]}')`);
  await deny('professional driving license rejects unsupported classes',`select public.camotes_mutate('admin.document.review','{"id":"${uid(2004)}","decision":"approved","license_kind":"professional","vehicle_classes":["airplane"]}')`);
  await mutateAction('admin.document.review',{id:uid(2005),decision:'rejected',reason:'Unreadable reference'});
  check('rejection records reason and never approves the evidence',(await one(`select status,rejection_reason from public.documents where id='${uid(2005)}'`)).status==='rejected');

  console.log(`\n${passed} checks passed. Local Postgres with Supabase auth/storage stubs; no live project accessed.`);
} catch(e) { console.error(e.message, e.detail || '', e.where || '', JSON.stringify({position:e.position,internalPosition:e.internalPosition,internalQuery:e.internalQuery,routine:e.routine})); process.exitCode=1; }
finally { await db.close(); }
