-- This role is deliberately created without LOGIN. Operations enables LOGIN and
-- sets its password outside migration history so credentials never enter Git.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'inout_api_runtime') then
    create role inout_api_runtime
      nologin
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls;
  end if;
end
$$;

grant usage on schema public to inout_api_runtime;
grant select on table public.household_members to inout_api_runtime;

create policy household_members_select_api_subject
on public.household_members
for select
to inout_api_runtime
using (user_id = (select auth.uid()));
