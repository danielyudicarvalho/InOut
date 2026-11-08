-- Goal progress is the net of an immutable allocation history. The accumulated
-- column remains a projection so existing readers stay valid, but it can no
-- longer move unless a contribution or its reversal explains the change.
create table public.goal_allocations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  goal_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  kind text not null check (kind in ('contribution', 'reversal')),
  origin text not null check (origin in ('recorded', 'opening')),
  reversal_of uuid,
  occurred_on date not null,
  note text check (note is null or char_length(btrim(note)) between 1 and 500),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, goal_id)
    references public.goals (household_id, id) on delete restrict,
  foreign key (household_id, reversal_of)
    references public.goal_allocations (household_id, id) on delete restrict,
  check (
    (kind = 'contribution' and reversal_of is null and origin in ('recorded', 'opening'))
    or (kind = 'reversal' and reversal_of is not null and origin = 'recorded')
  )
);

create unique index goal_allocations_one_reversal_per_original_uidx
  on public.goal_allocations (household_id, reversal_of)
  where kind = 'reversal';
create unique index goal_allocations_one_opening_per_goal_uidx
  on public.goal_allocations (household_id, goal_id)
  where origin = 'opening';
create index goal_allocations_goal_idx
  on public.goal_allocations (household_id, goal_id, occurred_on, created_at);

comment on table public.goal_allocations is
  'Immutable contributions and reversals that explain goals.allocated_cents.';
comment on column public.goals.allocated_cents is
  'Projection of goal_allocations. A positive legacy balance with no currency remains unresolved until a currency is selected.';

create function public.enforce_goal_allocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  goal_currency text;
begin
  select goal.currency into goal_currency
    from public.goals as goal
   where goal.household_id = new.household_id
     and goal.id = new.goal_id;
  if goal_currency is null or goal_currency is distinct from new.currency then
    raise exception using errcode = '23514', message = 'goal_allocation_currency_mismatch';
  end if;
  if new.kind = 'reversal' and not exists (
    select 1
      from public.goal_allocations as original
     where original.household_id = new.household_id
       and original.id = new.reversal_of
       and original.goal_id = new.goal_id
       and original.kind = 'contribution'
       and original.amount_cents = new.amount_cents
       and original.currency = new.currency
  ) then
    raise exception using errcode = '23514', message = 'goal_allocation_reversal_mismatch';
  end if;
  return new;
end;
$$;

create function public.protect_goal_allocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '23514', message = 'goal_allocation_immutable';
end;
$$;

create function public.sync_goal_allocated_cents()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_goal uuid := coalesce(new.goal_id, old.goal_id);
  target_household uuid := coalesce(new.household_id, old.household_id);
  net bigint;
begin
  select coalesce(sum(
    case when allocation.kind = 'reversal' then -allocation.amount_cents else allocation.amount_cents end
  ), 0)
    into net
    from public.goal_allocations as allocation
   where allocation.household_id = target_household
     and allocation.goal_id = target_goal;
  update public.goals
     set allocated_cents = net,
         updated_at = now()
   where household_id = target_household
     and id = target_goal
     and currency is not null
     and allocated_cents is distinct from net;
  return null;
end;
$$;

create function public.protect_goal_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  net bigint;
begin
  if new.allocated_cents is distinct from old.allocated_cents then
    select coalesce(sum(
      case when allocation.kind = 'reversal' then -allocation.amount_cents else allocation.amount_cents end
    ), 0)
      into net
      from public.goal_allocations as allocation
     where allocation.household_id = new.household_id
       and allocation.goal_id = new.id;
    if new.allocated_cents is distinct from net then
      raise exception using errcode = '23514', message = 'goal_progress_requires_allocation';
    end if;
  end if;
  return new;
end;
$$;

create function public.record_goal_opening_allocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.currency is not null
     and new.allocated_cents > 0
     and (tg_op = 'INSERT' or old.currency is null)
     and not exists (
       select 1
         from public.goal_allocations as allocation
        where allocation.household_id = new.household_id
          and allocation.goal_id = new.id
     ) then
    insert into public.goal_allocations (
      household_id, goal_id, amount_cents, currency, kind, origin,
      occurred_on, created_by, created_at)
    values (
      new.household_id, new.id, new.allocated_cents, new.currency,
      'contribution', 'opening', new.created_at::date, new.created_by, new.created_at);
  end if;
  return null;
end;
$$;

revoke all on function public.enforce_goal_allocation() from public;
revoke all on function public.protect_goal_allocation() from public;
revoke all on function public.sync_goal_allocated_cents() from public;
revoke all on function public.protect_goal_progress() from public;
revoke all on function public.record_goal_opening_allocation() from public;
grant execute on function public.enforce_goal_allocation() to authenticated, inout_api_runtime;
grant execute on function public.protect_goal_allocation() to authenticated, inout_api_runtime;
grant execute on function public.sync_goal_allocated_cents() to authenticated, inout_api_runtime;
grant execute on function public.protect_goal_progress() to authenticated, inout_api_runtime;
grant execute on function public.record_goal_opening_allocation() to authenticated, inout_api_runtime;

create trigger goal_allocations_enforce
  before insert on public.goal_allocations
  for each row execute function public.enforce_goal_allocation();
create trigger goal_allocations_immutable
  before update or delete on public.goal_allocations
  for each row execute function public.protect_goal_allocation();
create trigger goal_allocations_sync_progress
  after insert on public.goal_allocations
  for each row execute function public.sync_goal_allocated_cents();
create trigger goals_protect_progress
  before update on public.goals
  for each row execute function public.protect_goal_progress();

-- Balances that already had an explicit currency become one opening allocation.
-- Null-currency balances stay unresolved; selecting a currency records the opening.
insert into public.goal_allocations (
  household_id, goal_id, amount_cents, currency, kind, origin,
  occurred_on, created_by, created_at)
select
  goal.household_id,
  goal.id,
  goal.allocated_cents,
  goal.currency,
  'contribution',
  'opening',
  goal.created_at::date,
  goal.created_by,
  goal.created_at
from public.goals as goal
where goal.allocated_cents > 0
  and goal.currency is not null;

create trigger goals_record_opening_allocation
  after insert or update of currency, allocated_cents on public.goals
  for each row execute function public.record_goal_opening_allocation();

alter table public.goal_allocations enable row level security;

create policy goal_allocations_select_member on public.goal_allocations
  for select to authenticated
  using ((select private.is_household_member(household_id)));
create policy goal_allocations_insert_member on public.goal_allocations
  for insert to authenticated
  with check (
    (select private.is_household_member(household_id))
    and created_by = (select auth.uid())
  );
create policy goal_allocations_select_api_member on public.goal_allocations
  for select to inout_api_runtime
  using ((select private.is_household_member(household_id)));
create policy goal_allocations_insert_api_member on public.goal_allocations
  for insert to inout_api_runtime
  with check ((select private.is_household_member(household_id)));

revoke all on table public.goal_allocations from anon, authenticated;
grant select, insert on public.goal_allocations to authenticated;
grant select, insert on public.goal_allocations to inout_api_runtime;
