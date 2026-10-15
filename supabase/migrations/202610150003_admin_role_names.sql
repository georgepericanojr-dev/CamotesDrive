-- Run after 202610150001_api.sql and 202610150002_remove_admin_mfa.sql.
-- Enrich the admin-only role list with the account name on every page.
-- Safe to reapply. Keeps user_id for mutations and leaves access checks intact.
begin;

do $migration$
declare
  definition text;
  normalized_definition text;
  normalized_new_branch text;
  old_branch constant text := $old$
    when 'roles' then return coalesce((select jsonb_agg(to_jsonb(q)) from (select * from public.user_roles order by created_at desc limit lim offset offst) q),'[]');
$old$;
  new_branch constant text := $new$
    when 'roles' then return coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc,q.user_id,q.role)
      from (
        select r.*,nullif(btrim(p.full_name),'') as full_name,p.account_status
        from public.user_roles r
        left join public.profiles p on p.id=r.user_id
        order by r.created_at desc,r.user_id,r.role
        limit lim offset offst
      ) q
    ),'[]');
$new$;
begin
  select pg_get_functiondef('public.camotes_read(text,jsonb)'::regprocedure)
    into definition;
  -- SQL Editor and migration files may use different line endings on reapply.
  -- Normalize comparisons only; preserve all unrelated deployed function text.
  normalized_definition := replace(definition,E'\r\n',E'\n');
  normalized_new_branch := replace(btrim(new_branch,E'\n\r'),E'\r\n',E'\n');
  if strpos(normalized_definition,normalized_new_branch) > 0 then
    -- Already upgraded; do not replace unrelated deployed function logic.
    return;
  end if;
  if strpos(definition,btrim(old_branch,E'\n\r')) = 0 then
    raise exception 'Unrecognized camotes_read roles branch. Review the deployed function before applying the admin role names migration.';
  end if;
  definition := replace(definition,btrim(old_branch,E'\n\r'),btrim(new_branch,E'\n\r'));
  execute definition;
end $migration$;

commit;
