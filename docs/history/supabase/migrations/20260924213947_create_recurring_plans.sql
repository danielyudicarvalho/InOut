create table public.recurring_plans (
  id uuid primary key,
  household_id uuid not null references public.households(id),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  flow text not null check (flow in ('income', 'expense')),
  account_id uuid not null,
  category_id uuid not null,
  income_source_id uuid,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  day_of_month integer not null check (day_of_month between 1 and 31),
  starts_on date not null,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_plans_period_chk check (ends_on is null or ends_on >= starts_on),
  constraint recurring_plans_source_flow_chk check (income_source_id is null or flow = 'income'),
  constraint recurring_plans_account_fkey foreign key (household_id, account_id)
    references public.accounts(household_id, id),
  constraint recurring_plans_category_fkey foreign key (household_id, category_id, flow)
    references public.categories(household_id, id, flow),
  constraint recurring_plans_source_fkey foreign key (household_id, income_source_id)
    references public.income_sources(household_id, id)
);

create index recurring_plans_household_status_idx
  on public.recurring_plans (household_id, status);

alter table public.recurring_plans enable row level security;
revoke all on public.recurring_plans from public, anon, authenticated;
grant select, insert, update(status, updated_at) on public.recurring_plans to inout_api_runtime;
create policy recurring_plans_select_api_member on public.recurring_plans for select to inout_api_runtime
  using ((select private.is_household_member(household_id)));
create policy recurring_plans_insert_api_actor on public.recurring_plans for insert to inout_api_runtime
  with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy recurring_plans_update_api_member on public.recurring_plans for update to inout_api_runtime
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
