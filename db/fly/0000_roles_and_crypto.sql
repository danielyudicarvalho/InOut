-- Fly Managed Postgres preamble.
-- These NOLOGIN roles exist only so the preserved policies and grants still parse.
-- The application never connects as them. inout_api_runtime is created by the
-- domain migrations and is NOBYPASSRLS. Identity rows live in identity.users,
-- which the EF migration creates before this script's dependents run.
-- pgcrypto is installed into schema extensions because the domain SQL calls
-- extensions.gen_random_bytes and extensions.digest. That schema is not a
-- hosted-provider service schema.

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

create schema if not exists private;

create or replace function private.auth_uid()
returns uuid
language sql
stable
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

revoke all on function private.auth_uid() from public;
comment on function private.auth_uid() is
  'Transaction-local subject set by the API with set_config(..., true) on the same connection. Empty or missing settings yield NULL.';
