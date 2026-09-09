create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_household_id_idx
  on public.household_members (user_id, household_id);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('cash', 'checking', 'savings', 'investment', 'other')),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (household_id, id)
);

create unique index accounts_household_active_name_uidx
  on public.accounts (household_id, lower(name))
  where archived_at is null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  parent_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  flow text not null check (flow in ('income', 'expense')),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (household_id, id),
  unique (household_id, id, flow),
  foreign key (household_id, parent_id, flow)
    references public.categories (household_id, id, flow) on delete restrict,
  check (parent_id is null or parent_id <> id)
);

create unique index categories_household_parent_active_name_uidx
  on public.categories (household_id, parent_id, lower(name)) nulls not distinct
  where archived_at is null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'transfer', 'reversal')),
  status text not null default 'draft' check (status in ('draft', 'posted', 'reversed', 'voided')),
  description text check (description is null or char_length(description) <= 500),
  occurred_on date not null,
  idempotency_key uuid not null,
  reversal_of uuid,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (household_id, id),
  unique (household_id, idempotency_key),
  foreign key (household_id, reversal_of)
    references public.transactions (household_id, id) on delete restrict,
  check ((kind = 'reversal') = (reversal_of is not null)),
  check ((status in ('posted', 'reversed')) = (posted_at is not null))
);

create index transactions_household_occurred_on_idx
  on public.transactions (household_id, occurred_on desc);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  transaction_id uuid not null,
  account_id uuid not null,
  category_id uuid,
  direction text not null check (direction in ('debit', 'credit')),
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, transaction_id)
    references public.transactions (household_id, id) on delete restrict,
  foreign key (household_id, account_id)
    references public.accounts (household_id, id) on delete restrict,
  foreign key (household_id, category_id)
    references public.categories (household_id, id) on delete restrict
);

create index entries_household_transaction_id_idx
  on public.entries (household_id, transaction_id);
create index entries_household_account_id_idx
  on public.entries (household_id, account_id);
create index entries_household_category_id_idx
  on public.entries (household_id, category_id)
  where category_id is not null;

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null,
  period_start date not null,
  period_end date not null,
  limit_cents bigint not null check (limit_cents > 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, category_id, period_start, period_end),
  foreign key (household_id, category_id)
    references public.categories (household_id, id) on delete restrict,
  check (period_end >= period_start)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  target_cents bigint not null check (target_cents > 0),
  allocated_cents bigint not null default 0 check (allocated_cents >= 0),
  target_date date,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (household_id, id)
);

create index goals_household_active_idx
  on public.goals (household_id)
  where archived_at is null;

create table public.audit_events (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(btrim(action)) between 1 and 100),
  entity_type text not null check (char_length(btrim(entity_type)) between 1 and 80),
  entity_id uuid,
  outcome text not null check (outcome in ('success', 'failure')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_household_occurred_at_idx
  on public.audit_events (household_id, occurred_at desc);

create function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as member
    where member.household_id = target_household_id
      and member.user_id = (select auth.uid())
  );
$$;

create function private.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as member
    where member.household_id = target_household_id
      and member.user_id = (select auth.uid())
      and member.role = 'owner'
  );
$$;

revoke all on function private.is_household_member(uuid) from public, anon;
revoke all on function private.is_household_owner(uuid) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;

create function public.create_household(household_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_household public.households;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if char_length(pg_catalog.btrim(household_name)) not between 1 and 80 then
    raise exception 'household name must contain between 1 and 80 characters'
      using errcode = '22023';
  end if;

  insert into public.households (name, created_by)
  values (pg_catalog.btrim(household_name), current_user_id)
  returning * into created_household;

  insert into public.household_members (household_id, user_id, role)
  values (created_household.id, current_user_id, 'owner');

  return created_household;
end;
$$;

revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

create function private.protect_last_household_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1
       from public.household_members as member
       where member.household_id = old.household_id
         and member.role = 'owner'
         and member.user_id <> old.user_id
     ) then
    raise exception 'a household must retain at least one owner'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.protect_last_household_owner() from public, anon, authenticated;

create trigger household_members_retain_owner
before update of role or delete on public.household_members
for each row execute function private.protect_last_household_owner();

create function private.protect_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_created_by() from public, anon, authenticated;

create trigger households_protect_created_by
before update of created_by on public.households
for each row execute function private.protect_created_by();
create trigger accounts_protect_created_by
before update of created_by on public.accounts
for each row execute function private.protect_created_by();
create trigger categories_protect_created_by
before update of created_by on public.categories
for each row execute function private.protect_created_by();
create trigger transactions_protect_created_by
before update of created_by on public.transactions
for each row execute function private.protect_created_by();
create trigger budgets_protect_created_by
before update of created_by on public.budgets
for each row execute function private.protect_created_by();
create trigger goals_protect_created_by
before update of created_by on public.goals
for each row execute function private.protect_created_by();

create function private.protect_household_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id is immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_household_id() from public, anon, authenticated;

create trigger household_members_protect_household_id
before update of household_id on public.household_members
for each row execute function private.protect_household_id();
create trigger accounts_protect_household_id
before update of household_id on public.accounts
for each row execute function private.protect_household_id();
create trigger categories_protect_household_id
before update of household_id on public.categories
for each row execute function private.protect_household_id();
create trigger transactions_protect_household_id
before update of household_id on public.transactions
for each row execute function private.protect_household_id();
create trigger entries_protect_household_id
before update of household_id on public.entries
for each row execute function private.protect_household_id();
create trigger budgets_protect_household_id
before update of household_id on public.budgets
for each row execute function private.protect_household_id();
create trigger goals_protect_household_id
before update of household_id on public.goals
for each row execute function private.protect_household_id();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.entries enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.audit_events enable row level security;

create policy households_select_member on public.households
for select to authenticated
using ((select private.is_household_member(id)));

create policy households_update_owner on public.households
for update to authenticated
using ((select private.is_household_owner(id)))
with check ((select private.is_household_owner(id)));

create policy household_members_select_member on public.household_members
for select to authenticated
using ((select private.is_household_member(household_id)));

create policy household_members_insert_owner on public.household_members
for insert to authenticated
with check ((select private.is_household_owner(household_id)));

create policy household_members_update_owner on public.household_members
for update to authenticated
using ((select private.is_household_owner(household_id)))
with check ((select private.is_household_owner(household_id)));

create policy household_members_delete_owner on public.household_members
for delete to authenticated
using ((select private.is_household_owner(household_id)));

create policy accounts_select_member on public.accounts
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy accounts_insert_member on public.accounts
for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);
create policy accounts_update_member on public.accounts
for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy accounts_delete_member on public.accounts
for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy categories_select_member on public.categories
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy categories_insert_member on public.categories
for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);
create policy categories_update_member on public.categories
for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy categories_delete_member on public.categories
for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy transactions_select_member on public.transactions
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy transactions_insert_member on public.transactions
for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);
create policy transactions_update_member on public.transactions
for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy transactions_delete_member on public.transactions
for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy entries_select_member on public.entries
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy entries_insert_member on public.entries
for insert to authenticated
with check ((select private.is_household_member(household_id)));
create policy entries_update_member on public.entries
for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy entries_delete_member on public.entries
for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy budgets_select_member on public.budgets
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy budgets_insert_member on public.budgets
for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);
create policy budgets_update_member on public.budgets
for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy budgets_delete_member on public.budgets
for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy goals_select_member on public.goals
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy goals_insert_member on public.goals
for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);
create policy goals_update_member on public.goals
for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy goals_delete_member on public.goals
for delete to authenticated
using ((select private.is_household_member(household_id)));

create policy audit_events_select_member on public.audit_events
for select to authenticated
using ((select private.is_household_member(household_id)));

revoke all on table public.households from anon, authenticated;
revoke all on table public.household_members from anon, authenticated;
revoke all on table public.accounts from anon, authenticated;
revoke all on table public.categories from anon, authenticated;
revoke all on table public.transactions from anon, authenticated;
revoke all on table public.entries from anon, authenticated;
revoke all on table public.budgets from anon, authenticated;
revoke all on table public.goals from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;
grant select, update on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.entries to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select on public.audit_events to authenticated;
