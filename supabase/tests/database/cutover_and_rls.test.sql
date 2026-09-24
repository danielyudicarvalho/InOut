begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select no_plan();

-- The Supabase test runner connects as postgres without membership in custom
-- roles. Grant only inside this transaction so SET ROLE can exercise the real
-- runtime policies; the final rollback removes the test-only membership.
grant inout_api_runtime to postgres;
grant usage on schema extensions to inout_api_runtime;

select has_table('public', 'households', 'households table exists');
select has_table('public', 'household_members', 'household_members table exists');
select has_table('public', 'accounts', 'accounts table exists');
select has_table('public', 'categories', 'categories table exists');
select has_table('public', 'transactions', 'transactions table exists');
select has_table('public', 'entries', 'entries table exists');
select has_table('public', 'budgets', 'budgets table exists');
select has_table('public', 'goals', 'goals table exists');
select has_table('public', 'audit_events', 'audit_events table exists');

select results_eq(
  $$
    select count(*)
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in (
        'households', 'household_members', 'accounts', 'categories',
        'transactions', 'entries', 'budgets', 'goals', 'audit_events'
      )
      and relrowsecurity
  $$,
  array[9::bigint],
  'RLS remains enabled on every exposed business table'
);

select ok(
  not has_table_privilege('anon', 'public.households', 'select')
  and not has_table_privilege('anon', 'public.transactions', 'insert'),
  'anon has no direct business-data privileges'
);

select ok(
  not has_table_privilege('authenticated', 'public.households', 'select')
  and not has_table_privilege('authenticated', 'public.transactions', 'insert')
  and not has_table_privilege('authenticated', 'public.entries', 'select'),
  'authenticated has no direct business-data privileges'
);

select ok(
  not has_function_privilege('authenticated', 'public.create_household(text)', 'execute'),
  'authenticated cannot execute create_household'
);
select ok(
  not has_function_privilege('authenticated', 'public.create_household_invite(uuid)', 'execute'),
  'authenticated cannot execute create_household_invite'
);
select ok(
  not has_function_privilege('authenticated', 'public.accept_household_invite(text)', 'execute'),
  'authenticated cannot execute accept_household_invite'
);

select ok(
  not (select rolbypassrls from pg_roles where rolname = 'inout_api_runtime'),
  'the API runtime cannot bypass RLS'
);
select ok(
  has_table_privilege('inout_api_runtime', 'public.household_members', 'select'),
  'the API runtime can resolve membership'
);
select ok(
  has_table_privilege('inout_api_runtime', 'public.accounts', 'select'),
  'the API runtime can validate accounts'
);
select ok(
  has_table_privilege('inout_api_runtime', 'public.transactions', 'select,insert,update'),
  'the API runtime can operate transactions without delete'
);
select ok(
  has_table_privilege('inout_api_runtime', 'public.entries', 'select,insert'),
  'the API runtime can append and query entries without update or delete'
);
select ok(
  not has_table_privilege('inout_api_runtime', 'public.entries', 'update')
  and not has_table_privilege('inout_api_runtime', 'public.entries', 'delete')
  and not has_table_privilege('inout_api_runtime', 'public.transactions', 'delete'),
  'runtime cannot mutate immutable ledger entries or delete transactions'
);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'owner-a@inout.test'),
  ('30000000-0000-0000-0000-000000000003', 'owner-b@inout.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Household A', '10000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Household B', '30000000-0000-0000-0000-000000000003');
insert into public.household_members (household_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'owner');
insert into public.accounts (id, household_id, name, kind, created_by) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Account A', 'checking', '10000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Account B', 'checking', '30000000-0000-0000-0000-000000000003');
insert into public.categories (id, household_id, name, flow, created_by) values
  ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Category A', 'income', '10000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Category B', 'income', '30000000-0000-0000-0000-000000000003');
insert into public.transactions (id, household_id, kind, status, occurred_on, created_by, posted_at) values
  ('a3000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'income', 'posted', current_date, '10000000-0000-0000-0000-000000000001', now()),
  ('b3000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'income', 'posted', current_date, '30000000-0000-0000-0000-000000000003', now());
insert into public.entries (household_id, transaction_id, account_id, direction, amount_cents, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'credit', 100, '10000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'credit', 200, '30000000-0000-0000-0000-000000000003');
insert into public.budgets (household_id, category_id, period_start, period_end, limit_cents, created_by) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', current_date, current_date, 500, '30000000-0000-0000-0000-000000000003');
insert into public.goals (household_id, name, target_cents, created_by) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Private goal', 500, '30000000-0000-0000-0000-000000000003');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ select * from public.households $$,
  '42501',
  'permission denied for table households',
  'the Flutter client cannot read business tables directly'
);

reset role;
set local role inout_api_runtime;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select results_eq(
  'select name from public.accounts order by name',
  array['Account A'::text],
  'the API runtime reads only the authenticated household'
);
select results_eq('select name from public.households', array['Household A'::text], 'household list excludes other homes');
select results_eq('select user_id from public.household_members', array['10000000-0000-0000-0000-000000000001'::uuid], 'membership list excludes other homes');
select results_eq('select name from public.categories', array['Category A'::text], 'categories exclude other homes');
select results_eq('select id from public.transactions', array['a3000000-0000-0000-0000-000000000001'::uuid], 'transactions exclude other homes');
select results_eq('select amount_cents from public.entries', array[100::bigint], 'entries exclude other homes');
select is((select count(*) from public.budgets), 0::bigint, 'dashboard budgets exclude other homes');
select is((select count(*) from public.goals), 0::bigint, 'dashboard goals exclude other homes');
select is((select count(*) from public.accounts where household_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint, 'direct account lookup excludes other homes');
select is((select count(*) from public.transactions where household_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint, 'direct transaction lookup excludes other homes');
select is((select count(*) from public.entries where household_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint, 'direct entry lookup excludes other homes');
select is((select count(*) from public.household_members where household_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint, 'direct membership lookup excludes other homes');
select is((select count(*) from (select id from public.accounts where id = 'b1000000-0000-0000-0000-000000000002' for update) locked), 0::bigint, 'row locks cannot expose other homes');
select lives_ok($test$
  do $block$
  declare changed_count integer;
  begin
    update public.transactions set status = 'voided'
    where household_id = 'bbbbbbbb-0000-0000-0000-000000000002';
    get diagnostics changed_count = row_count;
    if changed_count <> 0 then raise exception 'cross-household transaction update succeeded'; end if;
  end $block$
$test$, 'updates cannot change another home');
select lives_ok($test$
  do $block$
  declare changed_count integer;
  begin
    update public.accounts set archived_at = now()
    where household_id = 'bbbbbbbb-0000-0000-0000-000000000002';
    get diagnostics changed_count = row_count;
    if changed_count <> 0 then raise exception 'cross-household account update succeeded'; end if;
  end $block$
$test$, 'account updates cannot change another home');
select throws_ok(
  $$
    insert into public.transactions (
      household_id, kind, status, occurred_on, created_by, posted_at
    ) values (
      'bbbbbbbb-0000-0000-0000-000000000002', 'income', 'posted', current_date,
      '10000000-0000-0000-0000-000000000001', now()
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "transactions"',
  'the API runtime cannot insert across households'
);
select lives_ok(
  $$
    insert into public.transactions (
      household_id, kind, status, occurred_on, created_by, posted_at
    ) values (
      'aaaaaaaa-0000-0000-0000-000000000001', 'income', 'posted', current_date,
      '10000000-0000-0000-0000-000000000001', now()
    )
  $$,
  'the API runtime inserts inside the authenticated household'
);
select throws_ok(
  $$ insert into public.entries (household_id, transaction_id, account_id, direction, amount_cents, created_by)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000002',
             'b1000000-0000-0000-0000-000000000002', 'credit', 300,
             '10000000-0000-0000-0000-000000000001') $$,
  '42501', 'new row violates row-level security policy for table "entries"',
  'entries cannot be inserted into another home'
);
select throws_ok(
  $$ insert into public.accounts (household_id, name, kind, created_by)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'Intruder', 'cash',
             '10000000-0000-0000-0000-000000000001') $$,
  '42501', 'new row violates row-level security policy for table "accounts"',
  'accounts cannot be inserted into another home'
);
select throws_ok(
  $$ insert into public.categories (household_id, name, flow, created_by)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'Intruder', 'income',
             '10000000-0000-0000-0000-000000000001') $$,
  '42501', 'new row violates row-level security policy for table "categories"',
  'categories cannot be inserted into another home'
);
select throws_ok(
  $$ delete from public.household_members where household_id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  '42501', 'permission denied for table household_members',
  'runtime cannot remove another home member'
);

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
select results_eq('select name from public.accounts', array['Account B'::text], 'switching user switches visible household');
set local request.jwt.claim.sub = '';
select is((select count(*) from public.accounts), 0::bigint, 'missing subject sees no accounts');

select * from finish();
rollback;
