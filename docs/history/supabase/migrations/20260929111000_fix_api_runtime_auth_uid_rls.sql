-- Fix auth.uid() permission issues for inout_api_runtime in Supabase Cloud
create or replace function private.auth_uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

grant execute on function private.auth_uid() to inout_api_runtime, authenticated;

-- Update private functions to use private.auth_uid()
create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as member
    where member.household_id = target_household_id
      and member.user_id = (select private.auth_uid())
  );
$$;

grant execute on function private.is_household_member(uuid) to inout_api_runtime, authenticated;

create or replace function private.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as member
    where member.household_id = target_household_id
      and member.user_id = (select private.auth_uid())
      and member.role = 'owner'
  );
$$;

grant execute on function private.is_household_owner(uuid) to inout_api_runtime, authenticated;

-- Update RLS policies for inout_api_runtime
alter policy households_insert_api_creator on public.households
with check ((select private.auth_uid()) is not null and created_by = (select private.auth_uid()));

alter policy households_select_api_member on public.households
using (
  created_by = (select private.auth_uid())
  or (select private.is_household_member(id))
);

alter policy household_members_insert_api_self on public.household_members
with check (
  (select private.auth_uid()) is not null
  and user_id = (select private.auth_uid())
  and role in ('owner', 'member')
);

alter policy household_members_select_api_household on public.household_members
using (
  user_id = (select private.auth_uid())
  or (select private.is_household_member(household_id))
);

grant select on table public.audit_events to inout_api_runtime;

alter policy audit_events_insert_api_actor on public.audit_events
with check (
  actor_user_id = (select private.auth_uid())
  and (select private.is_household_member(household_id))
);

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_events' and policyname = 'audit_events_select_api_member') then
    create policy audit_events_select_api_member on public.audit_events for select to inout_api_runtime using ((select private.is_household_member(household_id)));
  end if;
end;
$$;

alter policy categories_insert_api_member on public.categories
with check (
  (select private.is_household_member(household_id))
  and created_by = (select private.auth_uid())
);

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_insert_api_member') then
    execute 'alter policy transactions_insert_api_member on public.transactions with check ((select private.is_household_member(household_id)) and created_by = (select private.auth_uid()))';
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_update_api_member') then
    execute 'alter policy transactions_update_api_member on public.transactions using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)) and created_by = (select private.auth_uid()))';
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entries' and policyname = 'entries_insert_api_member') then
    execute 'alter policy entries_insert_api_member on public.entries with check ((select private.is_household_member(household_id)) and created_by = (select private.auth_uid()))';
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_insert_api_member') then
    execute 'alter policy accounts_insert_api_member on public.accounts with check ((select private.is_household_member(household_id)) and created_by = (select private.auth_uid()))';
  end if;
end;
$$;
