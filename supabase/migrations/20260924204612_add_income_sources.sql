begin;

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (household_id, id)
);

create unique index income_sources_active_name_key
  on public.income_sources (household_id, lower(name)) where archived_at is null;

alter table public.transactions add column income_source_id uuid;
alter table public.transactions add constraint transactions_income_source_kind_chk
  check (income_source_id is null or kind = 'income');
alter table public.transactions add constraint transactions_income_source_household_fkey
  foreign key (household_id, income_source_id)
  references public.income_sources (household_id, id);
create index transactions_income_source_idx on public.transactions (household_id, income_source_id)
  where income_source_id is not null;

alter table public.income_sources enable row level security;
create policy income_sources_select_member on public.income_sources for select to authenticated
  using ((select private.is_household_member(household_id)));
create policy income_sources_insert_member on public.income_sources for insert to authenticated
  with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy income_sources_update_member on public.income_sources for update to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

-- The API runtime reads and writes under a scoped user session.
grant select, insert, update on public.income_sources to inout_api_runtime;
create policy income_sources_api_select on public.income_sources for select to inout_api_runtime
  using ((select private.is_household_member(household_id)));
create policy income_sources_api_insert on public.income_sources for insert to inout_api_runtime
  with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy income_sources_api_update on public.income_sources for update to inout_api_runtime
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

commit;
