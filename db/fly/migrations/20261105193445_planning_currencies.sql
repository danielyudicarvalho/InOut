-- Existing planning amounts have no reliable currency provenance. Preserve them
-- as unresolved; never infer their currency from the household's current accounts.
alter table public.budgets add column currency text;
alter table public.goals add column currency text;
alter table public.budgets add constraint budgets_currency_format
  check (currency is null or currency ~ '^[A-Z]{3}$');
alter table public.goals add constraint goals_currency_format
  check (currency is null or currency ~ '^[A-Z]{3}$');
comment on column public.budgets.currency is 'Required for new records. NULL identifies legacy amounts awaiting explicit currency selection.';
comment on column public.goals.currency is 'Required for new records. NULL identifies legacy amounts awaiting explicit currency selection.';

-- Replace the original uniqueness rule, including databases where PostgreSQL
-- truncated the automatically generated constraint name.
do $$
declare old_constraint record;
begin
  for old_constraint in
    select c.conname from pg_catalog.pg_constraint c
    where c.conrelid = 'public.budgets'::regclass and c.contype = 'u'
      and (select array_agg(a.attname::text order by k.ordinality)
           from unnest(c.conkey) with ordinality k(attnum, ordinality)
           join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum)
          = array['household_id', 'category_id', 'period_start', 'period_end']
  loop
    execute format('alter table public.budgets drop constraint %I', old_constraint.conname);
  end loop;
end $$;
create unique index budgets_household_category_period_currency_key
  on public.budgets (household_id, category_id, period_start, period_end, currency)
  nulls not distinct;

-- Legacy NULLs remain readable. Any new or edited record needs an explicit
-- currency. Once assigned, changing it would reinterpret historical amounts.
create function public.enforce_planning_currency()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.currency is null or new.currency !~ '^[A-Z]{3}$' then
    raise exception using errcode = '23514', message = 'planning_currency_required';
  end if;
  if tg_op = 'UPDATE' then
    if old.currency is not null and old.currency is distinct from new.currency then
      raise exception using errcode = '23514', message = 'planning_currency_immutable';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_planning_currency() from public;
create trigger budgets_enforce_currency before insert or update on public.budgets
  for each row execute function public.enforce_planning_currency();
create trigger goals_enforce_currency before insert or update on public.goals
  for each row execute function public.enforce_planning_currency();
