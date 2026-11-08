begin;

-- 1. Accounts
alter table public.accounts
  add column if not exists status text not null default 'active'
  check (status in ('active', 'frozen', 'archived'));

update public.accounts
  set status = 'archived'
  where archived_at is not null and status != 'archived';

create index if not exists accounts_household_status_idx
  on public.accounts (household_id, status);

grant update (status) on table public.accounts to inout_api_runtime;

-- 2. Categories
alter table public.categories
  add column if not exists status text not null default 'active'
  check (status in ('active', 'deprecated', 'archived'));

update public.categories
  set status = 'archived'
  where archived_at is not null and status != 'archived';

create index if not exists categories_household_status_idx
  on public.categories (household_id, status);

grant update (status) on table public.categories to inout_api_runtime;

-- 3. Income Sources
alter table public.income_sources
  add column if not exists status text not null default 'active'
  check (status in ('active', 'archived'));

update public.income_sources
  set status = 'archived'
  where archived_at is not null and status != 'archived';

create index if not exists income_sources_household_status_idx
  on public.income_sources (household_id, status);

grant update (status) on table public.income_sources to inout_api_runtime;

-- 4. Goals
alter table public.goals
  add column if not exists status text not null default 'active'
  check (status in ('active', 'paused', 'completed', 'archived'));

update public.goals
  set status = 'archived'
  where archived_at is not null and status != 'archived';

create index if not exists goals_household_status_idx
  on public.goals (household_id, status);

grant update (status) on table public.goals to inout_api_runtime;

commit;
