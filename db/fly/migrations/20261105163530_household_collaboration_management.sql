-- Collaboration is managed through the authenticated ASP.NET boundary.
alter table private.household_invitations add column revoked_at timestamptz;
create index household_invitations_household_created on private.household_invitations (household_id, created_at desc);

grant update (role), delete on public.household_members to inout_api_runtime;
create policy household_members_update_api_owner on public.household_members
for update to inout_api_runtime
using ((select private.is_household_owner(household_id)))
with check ((select private.is_household_member(household_id)) and role in ('owner','member'));
create policy household_members_delete_api_owner_or_self on public.household_members
for delete to inout_api_runtime
using (user_id = (select private.auth_uid()) or (select private.is_household_owner(household_id)));

-- A trigger must see every responsible member to enforce this cross-row invariant.
-- It is internal, not an RPC, and serializes the same household as the API store.
create function private.guard_household_responsible_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.household_id::text, 0));
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if (select pg_catalog.count(*) from public.household_members where household_id = old.household_id and role = 'owner' and user_id <> old.user_id) = 0 then
      raise exception 'last_household_owner' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_household_responsible_member() from public, anon, authenticated, inout_api_runtime;
create trigger household_members_preserve_responsible
before update of role or delete on public.household_members
for each row execute function private.guard_household_responsible_member();

alter policy household_invitations_select_api on private.household_invitations
using (accepted_by = (select private.auth_uid()) or (select private.is_household_owner(household_id)) or (accepted_at is null and revoked_at is null and expires_at > now()));
create policy household_invitations_update_api_owner on private.household_invitations
for update to inout_api_runtime
using ((select private.is_household_owner(household_id)))
with check ((select private.is_household_owner(household_id)));
alter policy household_invitations_update_api_accept on private.household_invitations
using (accepted_at is null and revoked_at is null and expires_at > now())
with check (accepted_by = (select private.auth_uid()) and accepted_at is not null and revoked_at is null);
