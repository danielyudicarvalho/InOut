create table public.household_change_signals (
  revision bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  changed_at timestamptz not null default now()
);

create index household_change_signals_household_revision_idx
  on public.household_change_signals (household_id, revision desc);

alter table public.household_change_signals enable row level security;

create function public.can_receive_household_signal(requested_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = requested_household_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function public.can_receive_household_signal(uuid)
  from public, anon;
grant execute on function public.can_receive_household_signal(uuid)
  to authenticated;

create policy household_change_signals_select_member
on public.household_change_signals
for select to authenticated
using ((select public.can_receive_household_signal(household_id)));

grant select on table public.household_change_signals to authenticated;
grant insert on table public.household_change_signals to inout_api_runtime;
grant usage, select on sequence public.household_change_signals_revision_seq
  to inout_api_runtime;

create policy household_change_signals_insert_api_member
on public.household_change_signals
for insert to inout_api_runtime
with check ((select private.is_household_member(household_id)));

create function private.signal_household_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.household_change_signals (household_id)
  values (new.household_id);
  return new;
end;
$$;

revoke all on function private.signal_household_change()
  from public, anon, authenticated;
grant execute on function private.signal_household_change()
  to inout_api_runtime;

create trigger audit_events_signal_household_change
after insert on public.audit_events
for each row execute function private.signal_household_change();

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'household_change_signals'
  ) then
    alter publication supabase_realtime add table public.household_change_signals;
  end if;
end
$$;

comment on table public.household_change_signals is
  'Minimal invalidation feed; clients always reconcile business data through the API.';
