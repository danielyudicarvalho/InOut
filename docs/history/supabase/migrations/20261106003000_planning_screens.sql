-- Budget limit history, financial projects, and the statuses those screens read.
-- Existing budgets and goals are not rewritten. A revision is recorded only when
-- a limit is set after this migration.

insert into public.status_types (code, name, description)
select 'financial_project_status', 'Financial Project Status', 'Open or closed household project'
where not exists (
  select 1 from public.status_types where code = 'financial_project_status'
);

insert into public.status_values (id, type_code, code, name, description)
select 16, 'financial_project_status', 'active', 'Active', 'Project can be planned and linked'
where not exists (select 1 from public.status_values where id = 16);

insert into public.status_values (id, type_code, code, name, description)
select 17, 'financial_project_status', 'closed', 'Closed', 'Project is closed and no longer changes'
where not exists (select 1 from public.status_values where id = 17);

create table public.budget_revisions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  budget_id uuid not null references public.budgets (id) on delete restrict,
  previous_limit_cents bigint,
  limit_cents bigint not null check (limit_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index budget_revisions_budget_idx
  on public.budget_revisions (household_id, budget_id, created_at);

comment on table public.budget_revisions is
  'Immutable history of budget limits. The current limit remains on budgets.';

create table public.financial_projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  planned_cents bigint not null check (planned_cents > 0),
  starts_on date not null,
  ends_on date,
  notes text check (notes is null or char_length(btrim(notes)) between 1 and 500),
  status_id int not null references public.status_values (id),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (household_id, id),
  check (ends_on is null or ends_on >= starts_on),
  check (status_id in (16, 17))
);

create table public.financial_project_lines (
  id uuid primary key,
  household_id uuid not null,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  flow text not null check (flow in ('income', 'expense')),
  amount_cents bigint not null check (amount_cents > 0),
  unique (household_id, id),
  foreign key (household_id, project_id)
    references public.financial_projects (household_id, id) on delete cascade
);

create table public.financial_project_movements (
  household_id uuid not null,
  project_id uuid not null,
  transaction_id uuid not null,
  linked_by uuid not null,
  linked_at timestamptz not null default now(),
  primary key (household_id, project_id, transaction_id),
  foreign key (household_id, project_id)
    references public.financial_projects (household_id, id) on delete cascade,
  foreign key (household_id, transaction_id)
    references public.transactions (household_id, id) on delete restrict
);

comment on table public.financial_projects is
  'A named plan. Linking a transaction does not rewrite the ledger.';
comment on table public.financial_project_movements is
  'Association between a project and a posted transaction. Amounts stay on the ledger.';

alter table public.budget_revisions enable row level security;
alter table public.financial_projects enable row level security;
alter table public.financial_project_lines enable row level security;
alter table public.financial_project_movements enable row level security;

create policy budget_revisions_select_member on public.budget_revisions
  for select to authenticated using ((select private.is_household_member(household_id)));
create policy budget_revisions_insert_member on public.budget_revisions
  for insert to authenticated with check ((select private.is_household_member(household_id)));
create policy budget_revisions_select_api on public.budget_revisions
  for select to inout_api_runtime using ((select private.is_household_member(household_id)));
create policy budget_revisions_insert_api on public.budget_revisions
  for insert to inout_api_runtime with check ((select private.is_household_member(household_id)));

create policy financial_projects_member on public.financial_projects
  for all to authenticated using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
create policy financial_projects_api on public.financial_projects
  for all to inout_api_runtime using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy financial_project_lines_member on public.financial_project_lines
  for all to authenticated using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
create policy financial_project_lines_api on public.financial_project_lines
  for all to inout_api_runtime using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy financial_project_movements_member on public.financial_project_movements
  for all to authenticated using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
create policy financial_project_movements_api on public.financial_project_movements
  for all to inout_api_runtime using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

grant select, insert on public.budget_revisions to authenticated, inout_api_runtime;
grant select, insert, update, delete on public.financial_projects to authenticated, inout_api_runtime;
grant select, insert, update, delete on public.financial_project_lines to authenticated, inout_api_runtime;
grant select, insert, update, delete on public.financial_project_movements to authenticated, inout_api_runtime;
