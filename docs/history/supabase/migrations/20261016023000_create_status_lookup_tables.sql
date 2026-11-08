begin;

-- ============================================================================
-- 1. Create Status Lookup Tables: status_types (Type) & status_values (Value)
-- ============================================================================

create table if not exists public.status_types (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.status_values (
  type_code text not null references public.status_types (code) on delete cascade,
  id int not null,
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  primary key (type_code, id),
  unique (type_code, code)
);

-- Row Level Security and permissions for reference lookup tables
alter table public.status_types enable row level security;
alter table public.status_values enable row level security;

create policy status_types_read_all on public.status_types for select using (true);
create policy status_values_read_all on public.status_values for select using (true);

grant select on table public.status_types to authenticated, anon, inout_api_runtime;
grant select on table public.status_values to authenticated, anon, inout_api_runtime;

-- Seed status_types
insert into public.status_types (code, name, description) values
  ('account_status', 'Account Status', 'Lifecycle statuses for financial accounts'),
  ('category_status', 'Category Status', 'Lifecycle statuses for transaction categories'),
  ('income_source_status', 'Income Source Status', 'Lifecycle statuses for household income sources'),
  ('goal_status', 'Goal Status', 'Lifecycle statuses for savings goals'),
  ('recurring_plan_status', 'Recurring Plan Status', 'Lifecycle statuses for recurring monthly plans')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

-- Seed status_values
insert into public.status_values (type_code, id, code, name, description) values
  -- AccountStatus: Active = 1, Frozen = 2, Archived = 3
  ('account_status', 1, 'active', 'Active', 'Account is active and can transact'),
  ('account_status', 2, 'frozen', 'Frozen', 'Account is frozen and cannot accept transactions'),
  ('account_status', 3, 'archived', 'Archived', 'Account is archived and closed'),

  -- CategoryStatus: Active = 1, Deprecated = 2, Archived = 3
  ('category_status', 1, 'active', 'Active', 'Category is active and can receive new transactions'),
  ('category_status', 2, 'deprecated', 'Deprecated', 'Category is deprecated and hidden from new assignments'),
  ('category_status', 3, 'archived', 'Archived', 'Category is archived'),

  -- IncomeSourceStatus: Active = 1, Archived = 2
  ('income_source_status', 1, 'active', 'Active', 'Income source is active and assignable'),
  ('income_source_status', 2, 'archived', 'Archived', 'Income source is archived'),

  -- GoalStatus: Active = 1, Paused = 2, Completed = 3, Archived = 4
  ('goal_status', 1, 'active', 'Active', 'Goal is active and tracking progress'),
  ('goal_status', 2, 'paused', 'Paused', 'Goal allocations are temporarily paused'),
  ('goal_status', 3, 'completed', 'Completed', 'Goal has reached target allocation'),
  ('goal_status', 4, 'archived', 'Archived', 'Goal is archived'),

  -- RecurringPlanStatus: Active = 1, Paused = 2, Archived = 3
  ('recurring_plan_status', 1, 'active', 'Active', 'Recurring plan is active and executing'),
  ('recurring_plan_status', 2, 'paused', 'Paused', 'Recurring plan is temporarily paused'),
  ('recurring_plan_status', 3, 'archived', 'Archived', 'Recurring plan is archived')
on conflict (type_code, id) do update set
  code = excluded.code,
  name = excluded.name,
  description = excluded.description;

-- ============================================================================
-- 2. Alter Accounts
-- ============================================================================

drop index if exists public.accounts_household_status_idx;
alter table public.accounts drop column if exists status;

alter table public.accounts
  add column if not exists status_type text not null default 'account_status' check (status_type = 'account_status'),
  add column if not exists status_id int not null default 1,
  add constraint accounts_status_fkey foreign key (status_type, status_id)
    references public.status_values (type_code, id);

update public.accounts
  set status_id = case when archived_at is not null then 3 else 1 end;

create index if not exists accounts_household_status_id_idx
  on public.accounts (household_id, status_id);

grant update (status_id) on table public.accounts to inout_api_runtime;

-- ============================================================================
-- 3. Alter Categories
-- ============================================================================

drop index if exists public.categories_household_status_idx;
alter table public.categories drop column if exists status;

alter table public.categories
  add column if not exists status_type text not null default 'category_status' check (status_type = 'category_status'),
  add column if not exists status_id int not null default 1,
  add constraint categories_status_fkey foreign key (status_type, status_id)
    references public.status_values (type_code, id);

update public.categories
  set status_id = case when archived_at is not null then 3 else 1 end;

create index if not exists categories_household_status_id_idx
  on public.categories (household_id, status_id);

grant update (status_id) on table public.categories to inout_api_runtime;

-- ============================================================================
-- 4. Alter Income Sources
-- ============================================================================

drop index if exists public.income_sources_household_status_idx;
alter table public.income_sources drop column if exists status;

alter table public.income_sources
  add column if not exists status_type text not null default 'income_source_status' check (status_type = 'income_source_status'),
  add column if not exists status_id int not null default 1,
  add constraint income_sources_status_fkey foreign key (status_type, status_id)
    references public.status_values (type_code, id);

update public.income_sources
  set status_id = case when archived_at is not null then 2 else 1 end;

create index if not exists income_sources_household_status_id_idx
  on public.income_sources (household_id, status_id);

grant update (status_id) on table public.income_sources to inout_api_runtime;

-- ============================================================================
-- 5. Alter Goals
-- ============================================================================

drop index if exists public.goals_household_status_idx;
alter table public.goals drop column if exists status;

alter table public.goals
  add column if not exists status_type text not null default 'goal_status' check (status_type = 'goal_status'),
  add column if not exists status_id int not null default 1,
  add constraint goals_status_fkey foreign key (status_type, status_id)
    references public.status_values (type_code, id);

update public.goals
  set status_id = case when archived_at is not null then 4 else 1 end;

create index if not exists goals_household_status_id_idx
  on public.goals (household_id, status_id);

grant update (status_id) on table public.goals to inout_api_runtime;

-- ============================================================================
-- 6. Alter Recurring Plans
-- ============================================================================

drop index if exists public.recurring_plans_household_status_idx;

alter table public.recurring_plans
  add column if not exists status_type text not null default 'recurring_plan_status' check (status_type = 'recurring_plan_status'),
  add column if not exists status_id int not null default 1;

update public.recurring_plans
  set status_id = case
    when status = 'paused' then 2
    when status = 'archived' then 3
    else 1
  end;

alter table public.recurring_plans drop column if exists status;

alter table public.recurring_plans
  add constraint recurring_plans_status_fkey foreign key (status_type, status_id)
    references public.status_values (type_code, id);

create index if not exists recurring_plans_household_status_id_idx
  on public.recurring_plans (household_id, status_id);

grant update (status_id) on table public.recurring_plans to inout_api_runtime;

commit;
