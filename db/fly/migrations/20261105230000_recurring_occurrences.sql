-- A calculated date is not an occurrence. Realizing one posts a ledger
-- transaction and records an immutable link to that predicted date. The same
-- plan date, and the same transaction, cannot be realized twice.
create unique index if not exists recurring_plans_household_id_uidx
  on public.recurring_plans (household_id, id);

create table public.recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plan_id uuid not null,
  scheduled_on date not null,
  transaction_id uuid not null,
  flow text not null check (flow in ('income', 'expense')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references identity.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  constraint recurring_occurrences_plan_date_uidx unique (household_id, plan_id, scheduled_on),
  constraint recurring_occurrences_transaction_uidx unique (transaction_id),
  foreign key (household_id, plan_id)
    references public.recurring_plans (household_id, id) on delete restrict,
  foreign key (household_id, transaction_id)
    references public.transactions (household_id, id) on delete restrict
);

create index recurring_occurrences_plan_idx
  on public.recurring_occurrences (household_id, plan_id, scheduled_on);

comment on table public.recurring_occurrences is
  'Immutable link from one predicted date of a recurring plan to the ledger transaction that realized it.';

create function public.enforce_recurring_occurrence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan_flow text;
  plan_account uuid;
  plan_category uuid;
  plan_source uuid;
  plan_amount bigint;
  plan_currency text;
  plan_day integer;
  plan_starts date;
  plan_ends date;
  plan_status text;
  expected_day integer;
  tx_kind text;
  tx_date date;
  tx_status text;
  tx_source uuid;
  entry_count integer;
  matching_entries integer;
begin
  select plan.flow, plan.account_id, plan.category_id, plan.income_source_id,
         plan.amount_cents, plan.currency, plan.day_of_month, plan.starts_on, plan.ends_on,
         status.code
    into plan_flow, plan_account, plan_category, plan_source,
         plan_amount, plan_currency, plan_day, plan_starts, plan_ends, plan_status
    from public.recurring_plans as plan
    join public.status_values as status on status.id = plan.status_id
   where plan.household_id = new.household_id
     and plan.id = new.plan_id;

  if plan_flow is null or plan_status is distinct from 'active' then
    raise exception using errcode = '23514', message = 'recurring_occurrence_plan_not_executable';
  end if;

  expected_day := least(
    plan_day,
    extract(day from (
      date_trunc('month', new.scheduled_on::timestamp) + interval '1 month' - interval '1 day'
    ))::integer);
  if new.scheduled_on < plan_starts
     or (plan_ends is not null and new.scheduled_on > plan_ends)
     or extract(day from new.scheduled_on)::integer is distinct from expected_day then
    raise exception using errcode = '23514', message = 'recurring_occurrence_not_scheduled';
  end if;

  select tx.kind, tx.occurred_on, tx.status, tx.income_source_id
    into tx_kind, tx_date, tx_status, tx_source
    from public.transactions as tx
   where tx.household_id = new.household_id
     and tx.id = new.transaction_id;

  select count(*)::integer into entry_count
    from public.entries as entry
   where entry.household_id = new.household_id
     and entry.transaction_id = new.transaction_id;

  select count(*)::integer into matching_entries
    from public.entries as entry
   where entry.household_id = new.household_id
     and entry.transaction_id = new.transaction_id
     and entry.account_id = plan_account
     and entry.category_id = plan_category
     and entry.amount_cents = plan_amount
     and entry.direction = case when plan_flow = 'income' then 'credit' else 'debit' end;

  if new.flow is distinct from plan_flow
     or new.amount_cents is distinct from plan_amount
     or new.currency is distinct from plan_currency
     or tx_kind is distinct from plan_flow
     or tx_date is distinct from new.scheduled_on
     or tx_status is distinct from 'posted'
     or tx_source is distinct from plan_source
     or entry_count is distinct from 1
     or matching_entries is distinct from 1 then
    raise exception using errcode = '23514', message = 'recurring_occurrence_transaction_mismatch';
  end if;

  return new;
end;
$$;

create function public.protect_recurring_occurrence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'recurring_occurrence_immutable';
end;
$$;

revoke all on function public.enforce_recurring_occurrence() from public;
revoke all on function public.protect_recurring_occurrence() from public;
grant execute on function public.enforce_recurring_occurrence() to authenticated, inout_api_runtime;
grant execute on function public.protect_recurring_occurrence() to authenticated, inout_api_runtime;

create trigger recurring_occurrences_enforce
  before insert on public.recurring_occurrences
  for each row execute function public.enforce_recurring_occurrence();
create trigger recurring_occurrences_immutable
  before update or delete on public.recurring_occurrences
  for each row execute function public.protect_recurring_occurrence();

alter table public.recurring_occurrences enable row level security;

create policy recurring_occurrences_select_member on public.recurring_occurrences
  for select to authenticated
  using ((select private.is_household_member(household_id)));
create policy recurring_occurrences_insert_member on public.recurring_occurrences
  for insert to authenticated
  with check (
    (select private.is_household_member(household_id))
    and created_by = (select private.auth_uid())
  );
create policy recurring_occurrences_select_api_member on public.recurring_occurrences
  for select to inout_api_runtime
  using ((select private.is_household_member(household_id)));
create policy recurring_occurrences_insert_api_member on public.recurring_occurrences
  for insert to inout_api_runtime
  with check ((select private.is_household_member(household_id)));

revoke all on table public.recurring_occurrences from anon, authenticated;
grant select, insert on public.recurring_occurrences to authenticated;
grant select, insert on public.recurring_occurrences to inout_api_runtime;
