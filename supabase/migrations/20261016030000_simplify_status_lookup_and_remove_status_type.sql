begin;

-- ============================================================================
-- 1. Drop old foreign keys and status_type columns from all entity tables
-- ============================================================================

alter table public.accounts drop constraint if exists accounts_status_fkey;
alter table public.accounts drop column if exists status_type;

alter table public.categories drop constraint if exists categories_status_fkey;
alter table public.categories drop column if exists status_type;

alter table public.income_sources drop constraint if exists income_sources_status_fkey;
alter table public.income_sources drop column if exists status_type;

alter table public.goals drop constraint if exists goals_status_fkey;
alter table public.goals drop column if exists status_type;

alter table public.recurring_plans drop constraint if exists recurring_plans_status_fkey;
alter table public.recurring_plans drop column if exists status_type;

-- ============================================================================
-- 2. Restructure public.status_values to have globally unique integer IDs
-- ============================================================================

drop table if exists public.status_values cascade;

create table public.status_values (
  id int primary key,
  type_code text not null references public.status_types (code) on delete cascade,
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (type_code, code)
);

alter table public.status_values enable row level security;
create policy status_values_read_all on public.status_values for select using (true);
grant select on table public.status_values to authenticated, anon, inout_api_runtime;

-- ============================================================================
-- 3. Seed status_values with incremental, globally unique IDs across all types
-- ============================================================================

insert into public.status_values (id, type_code, code, name, description) values
  -- AccountStatus: Active = 1, Frozen = 2, Archived = 3
  (1, 'account_status', 'active', 'Active', 'Account is active and can transact'),
  (2, 'account_status', 'frozen', 'Frozen', 'Account is frozen and cannot accept transactions'),
  (3, 'account_status', 'archived', 'Archived', 'Account is archived and closed'),

  -- CategoryStatus: Active = 4, Deprecated = 5, Archived = 6
  (4, 'category_status', 'active', 'Active', 'Category is active and can receive new transactions'),
  (5, 'category_status', 'deprecated', 'Deprecated', 'Category is deprecated and hidden from new assignments'),
  (6, 'category_status', 'archived', 'Archived', 'Category is archived'),

  -- IncomeSourceStatus: Active = 7, Archived = 8
  (7, 'income_source_status', 'active', 'Active', 'Income source is active and assignable'),
  (8, 'income_source_status', 'archived', 'Archived', 'Income source is archived'),

  -- GoalStatus: Active = 9, Paused = 10, Completed = 11, Archived = 12
  (9, 'goal_status', 'active', 'Active', 'Goal is active and tracking progress'),
  (10, 'goal_status', 'paused', 'Paused', 'Goal allocations are temporarily paused'),
  (11, 'goal_status', 'completed', 'Completed', 'Goal has reached target allocation'),
  (12, 'goal_status', 'archived', 'Archived', 'Goal is archived'),

  -- RecurringPlanStatus: Active = 13, Paused = 14, Archived = 15
  (13, 'recurring_plan_status', 'active', 'Active', 'Recurring plan is active and executing'),
  (14, 'recurring_plan_status', 'paused', 'Paused', 'Recurring plan is temporarily paused'),
  (15, 'recurring_plan_status', 'archived', 'Archived', 'Recurring plan is archived')
on conflict (id) do update set
  type_code = excluded.type_code,
  code = excluded.code,
  name = excluded.name,
  description = excluded.description;

-- ============================================================================
-- 4. Re-align entity status_id values and add direct foreign key references
-- ============================================================================

-- Accounts
update public.accounts
  set status_id = case when archived_at is not null then 3 else 1 end;

alter table public.accounts
  alter column status_id set default 1,
  add constraint accounts_status_fkey foreign key (status_id) references public.status_values (id);

-- Categories
update public.categories
  set status_id = case when archived_at is not null then 6 else 4 end;

alter table public.categories
  alter column status_id set default 4,
  add constraint categories_status_fkey foreign key (status_id) references public.status_values (id);

-- Income Sources
update public.income_sources
  set status_id = case when archived_at is not null then 8 else 7 end;

alter table public.income_sources
  alter column status_id set default 7,
  add constraint income_sources_status_fkey foreign key (status_id) references public.status_values (id);

-- Goals
update public.goals
  set status_id = case when archived_at is not null then 12 else 9 end;

alter table public.goals
  alter column status_id set default 9,
  add constraint goals_status_fkey foreign key (status_id) references public.status_values (id);

-- Recurring Plans
update public.recurring_plans
  set status_id = case
    when status_id in (2, 14) then 14
    when status_id in (3, 15) then 15
    else 13
  end;

alter table public.recurring_plans
  alter column status_id set default 13,
  add constraint recurring_plans_status_fkey foreign key (status_id) references public.status_values (id);

commit;
