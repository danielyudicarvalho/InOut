grant usage on schema public, private to inout_api_runtime;
grant select, insert on table public.households to inout_api_runtime;
grant select, insert on table public.household_members to inout_api_runtime;
grant insert on table public.audit_events to inout_api_runtime;
grant usage, select on sequence public.audit_events_id_seq to inout_api_runtime;
grant select, insert, update, delete on table private.household_invitations to inout_api_runtime;
grant execute on function private.is_household_member(uuid) to inout_api_runtime;
grant execute on function private.is_household_owner(uuid) to inout_api_runtime;

drop policy household_members_select_api_subject on public.household_members;
create policy household_members_select_api_household
on public.household_members
for select to inout_api_runtime
using ((select private.is_household_member(household_id)));

create policy households_select_api_member
on public.households
for select to inout_api_runtime
using ((select private.is_household_member(id)));

create policy households_insert_api_creator
on public.households
for insert to inout_api_runtime
with check ((select auth.uid()) is not null and created_by = (select auth.uid()));

create policy household_members_insert_api_self
on public.household_members
for insert to inout_api_runtime
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and role in ('owner', 'member')
);

create policy audit_events_insert_api_actor
on public.audit_events
for insert to inout_api_runtime
with check (
  actor_user_id = (select auth.uid())
  and (select private.is_household_member(household_id))
);

alter table private.household_invitations enable row level security;

create policy household_invitations_select_api
on private.household_invitations
for select to inout_api_runtime
using (
  created_by = (select auth.uid())
  or (accepted_at is null and expires_at > now())
);

create policy household_invitations_insert_api_owner
on private.household_invitations
for insert to inout_api_runtime
with check (
  created_by = (select auth.uid())
  and (select private.is_household_owner(household_id))
);

create policy household_invitations_delete_api_owner
on private.household_invitations
for delete to inout_api_runtime
using ((select private.is_household_owner(household_id)));

create policy household_invitations_update_api_accept
on private.household_invitations
for update to inout_api_runtime
using (accepted_at is null and expires_at > now())
with check (
  accepted_by = (select auth.uid())
  and accepted_at is not null
);

create function private.enforce_household_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.households where id = new.household_id for update;

  if (
    select pg_catalog.count(*)
    from public.household_members
    where household_id = new.household_id
  ) >= 2 then
    raise exception 'household already has two members' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_household_member_limit() from public, anon, authenticated, inout_api_runtime;

create trigger household_members_enforce_limit
before insert on public.household_members
for each row execute function private.enforce_household_member_limit();
