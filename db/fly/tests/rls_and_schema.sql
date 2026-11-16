-- Fly-shaped disposable Postgres: schema presence, grants, and household RLS.
-- Run after `dotnet run --project src/InOut.Api -- migrate`. No pgtap.
\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1 from pg_roles
    where rolname in ('anon', 'authenticated', 'service_role', 'inout_api_runtime')
      and (rolbypassrls or rolsuper or rolcanlogin)
  ) then
    raise exception 'anon/authenticated/service_role/inout_api_runtime must be nologin, nosuperuser, nobypassrls';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ) then
    raise exception 'public table without RLS: %', (
      select string_agg(c.relname, ', ' order by c.relname)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    );
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'identity'
      and c.relname in ('users', 'auth_attempts', 'browser_sessions', 'login_tickets')
      and c.relrowsecurity
  ) then
    raise exception 'identity lookup tables must not be RLS-protected';
  end if;

  if not exists (select 1 from identity.schema_files where filename = '0000_roles_and_crypto.sql')
     or not exists (select 1 from identity.schema_files where filename = '9010_runtime_grants.sql') then
    raise exception 'migrator did not record 0000 and 9010 schema files';
  end if;

  if to_regclass('identity.auth_attempts') is null
     or to_regclass('identity.browser_sessions') is null
     or to_regclass('identity.login_tickets') is null then
    raise exception 'identity security tables missing';
  end if;

  if has_schema_privilege('anon', 'identity', 'usage')
     or has_schema_privilege('authenticated', 'identity', 'usage') then
    raise exception 'anon/authenticated must not use schema identity';
  end if;

  if not has_function_privilege('inout_api_runtime', 'extensions.digest(text,text)', 'execute')
     or not has_function_privilege('inout_api_runtime', 'extensions.gen_random_bytes(integer)', 'execute')
     or has_function_privilege('inout_api_runtime', 'extensions.armor(bytea)', 'execute') then
    raise exception '9010 must allow digest/gen_random_bytes only';
  end if;

  if has_table_privilege('anon', 'public.accounts', 'select')
     or has_table_privilege('anon', 'public.households', 'select')
     or has_table_privilege('inout_api_runtime', 'public.accounts', 'truncate') then
    raise exception 'anon or runtime has unexpected table privilege';
  end if;
end
$$;

insert into identity.users (
  id, user_name, normalized_user_name, email, normalized_email,
  email_confirmed, password_hash, security_stamp, concurrency_stamp,
  phone_number_confirmed, two_factor_enabled, lockout_enabled,
  access_failed_count, mfa_reenrollment_required
) values
  (
    'a1a1a1a1-0000-0000-0000-000000000001', 'a1@inout.test', 'A1@INOUT.TEST',
    'a1@inout.test', 'A1@INOUT.TEST', true, 'unused', 'stamp-a', 'c-a',
    false, false, false, 0, false
  ),
  (
    'b1b1b1b1-0000-0000-0000-000000000001', 'b1@inout.test', 'B1@INOUT.TEST',
    'b1@inout.test', 'B1@INOUT.TEST', true, 'unused', 'stamp-b', 'c-b',
    false, false, false, 0, false
  )
on conflict (id) do nothing;

insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Household A', 'a1a1a1a1-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Household B', 'b1b1b1b1-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.household_members (household_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a1a1a1a1-0000-0000-0000-000000000001', 'owner'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b1b1b1b1-0000-0000-0000-000000000001', 'owner')
on conflict do nothing;

insert into public.accounts (id, household_id, name, kind, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Account a', 'checking', 'a1a1a1a1-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Account b', 'checking', 'b1b1b1b1-0000-0000-0000-000000000001')
on conflict (id) do nothing;

grant inout_api_runtime to current_user;

create or replace function pg_temp.expect_sqlstate(statement text, wanted text)
returns void
language plpgsql as $f$
begin
  execute statement;
  raise exception 'expected SQLSTATE %, statement succeeded: %', wanted, statement;
exception
  when others then
    if sqlstate is distinct from wanted then
      raise exception 'expected SQLSTATE %, got % for %', wanted, sqlstate, statement;
    end if;
end;
$f$;
grant execute on function pg_temp.expect_sqlstate(text, text) to public;

begin;
set local role inout_api_runtime;
select set_config('request.jwt.claim.sub', 'a1a1a1a1-0000-0000-0000-000000000001', true);

do $$
declare n bigint;
begin
  if private.auth_uid() is distinct from 'a1a1a1a1-0000-0000-0000-000000000001'::uuid then
    raise exception 'private.auth_uid() did not resolve the request subject';
  end if;

  select count(*) into n from public.households;
  if n <> 1 then
    raise exception 'runtime A must see exactly one household, saw %', n;
  end if;

  select count(*) into n from public.accounts where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  if n <> 0 then
    raise exception 'runtime A must not read household B accounts';
  end if;

  select count(*) into n from public.accounts where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a';
  if n <> 1 then
    raise exception 'runtime A must read household A accounts';
  end if;
end
$$;

select pg_temp.expect_sqlstate(
  $stmt$
    insert into public.accounts (household_id, name, kind, created_by)
    values (
      'bbbbbbbb-0000-0000-0000-00000000000b',
      'cross-tenant',
      'checking',
      'a1a1a1a1-0000-0000-0000-000000000001'
    )
  $stmt$,
  '42501'
);

select pg_temp.expect_sqlstate(
  $stmt$
    insert into public.households (name, created_by)
    values ('spoofed', 'b1b1b1b1-0000-0000-0000-000000000001')
  $stmt$,
  '42501'
);

select set_config('request.jwt.claim.sub', '', true);
do $$
declare n bigint;
begin
  select count(*) into n from public.households;
  if n <> 0 then
    raise exception 'empty subject must see zero households, saw %', n;
  end if;
end
$$;

commit;

do $$
begin
  raise notice 'Fly schema, grants, and household RLS checks passed.';
end
$$;
