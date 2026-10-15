-- Run after the initial schema and 202610150001_api.sql.
-- Removes the admin MFA gate while preserving authenticated active-role checks.
-- Safe to reapply. Does not modify users, roles, or enrolled Auth factors.
begin;

create or replace function camotes_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.role() = 'authenticated' and camotes_private.has_role('admin');
$$;

-- Update existing API error messages without replacing unrelated deployed logic.
do $migration$
declare signature text; definition text;
begin
 foreach signature in array array['public.camotes_read(text,jsonb)', 'public.camotes_mutate(text,jsonb)'] loop
   select pg_get_functiondef(signature::regprocedure) into definition;
   definition = replace(definition, 'Admin role and MFA required', 'Active admin role required');
   definition = replace(definition, 'Owner or MFA admin required', 'Active owner or admin role required');
   execute definition;
 end loop;
end $migration$;

commit;
