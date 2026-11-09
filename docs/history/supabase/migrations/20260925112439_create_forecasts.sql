create table public.forecasts (
  id uuid primary key,
  household_id uuid not null references public.households(id),
  account_id uuid not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  as_of date not null,
  months integer not null check (months between 1 and 12),
  opening_balance_cents bigint not null,
  points jsonb not null check (jsonb_typeof(points) = 'array'),
  calculated_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  constraint forecasts_account_fkey foreign key (household_id, account_id)
    references public.accounts(household_id, id)
);
create index forecasts_household_calculated_idx on public.forecasts
  (household_id, calculated_at desc);
alter table public.forecasts enable row level security;
revoke all on public.forecasts from public, anon, authenticated;
grant select, insert on public.forecasts to inout_api_runtime;
create policy forecasts_select_api_member on public.forecasts for select to inout_api_runtime
  using ((select private.is_household_member(household_id)));
create policy forecasts_insert_api_actor on public.forecasts for insert to inout_api_runtime
  with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
