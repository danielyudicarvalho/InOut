begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(24);

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

select * from finish();
rollback;
