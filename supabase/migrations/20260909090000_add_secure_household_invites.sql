create extension if not exists pgcrypto with schema extensions;

create table private.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id) on delete restrict,
  accepted_at timestamptz,
  check (expires_at > created_at),
  check ((accepted_by is null) = (accepted_at is null))
);

revoke all on table private.household_invitations from public, anon, authenticated;

create function public.create_household_invite(target_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  invite_code text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not private.is_household_owner(target_household_id) then
    raise exception 'only a household owner can create an invite'
      using errcode = '42501';
  end if;

  perform 1
  from public.households
  where id = target_household_id
  for update;

  if (
    select pg_catalog.count(*)
    from public.household_members
    where household_id = target_household_id
  ) >= 2 then
    raise exception 'household already has two members' using errcode = '23514';
  end if;

  delete from private.household_invitations
  where household_id = target_household_id
    and accepted_at is null;

  invite_code := encode(extensions.gen_random_bytes(24), 'hex');

  insert into private.household_invitations (
    household_id,
    token_hash,
    created_by,
    expires_at
  ) values (
    target_household_id,
    extensions.digest(invite_code, 'sha256'),
    current_user_id,
    now() + interval '24 hours'
  );

  return invite_code;
end;
$$;

create function public.accept_household_invite(invite_code text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  invitation private.household_invitations;
  accepted_household public.households;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if invite_code is null or char_length(invite_code) <> 48 then
    raise exception 'invalid or expired invite' using errcode = '22023';
  end if;

  select * into invitation
  from private.household_invitations
  where token_hash = extensions.digest(invite_code, 'sha256')
    and accepted_at is null
    and expires_at > now()
  for update;

  if invitation.id is null then
    raise exception 'invalid or expired invite' using errcode = '22023';
  end if;

  perform 1
  from public.households
  where id = invitation.household_id
  for update;

  if exists (
    select 1
    from public.household_members
    where household_id = invitation.household_id
      and user_id = current_user_id
  ) then
    raise exception 'user is already a household member' using errcode = '23505';
  end if;

  if (
    select pg_catalog.count(*)
    from public.household_members
    where household_id = invitation.household_id
  ) >= 2 then
    raise exception 'household already has two members' using errcode = '23514';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, current_user_id, 'member')
  on conflict (household_id, user_id) do nothing;

  update private.household_invitations
  set accepted_by = current_user_id,
      accepted_at = now()
  where id = invitation.id;

  select * into accepted_household
  from public.households
  where id = invitation.household_id;

  return accepted_household;
end;
$$;

revoke all on function public.create_household_invite(uuid) from public, anon;
revoke all on function public.accept_household_invite(text) from public, anon;
grant execute on function public.create_household_invite(uuid) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;

drop policy household_members_insert_owner on public.household_members;
revoke insert on table public.household_members from authenticated;

alter table public.entries add column created_by uuid references auth.users (id) on delete restrict;
update public.entries as entry
set created_by = transaction.created_by
from public.transactions as transaction
where transaction.household_id = entry.household_id
  and transaction.id = entry.transaction_id;
alter table public.entries alter column created_by set not null;

create trigger entries_protect_created_by
before update of created_by on public.entries
for each row execute function private.protect_created_by();

drop policy entries_insert_member on public.entries;
create policy entries_insert_member on public.entries
for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);
