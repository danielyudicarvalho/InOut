begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(28);

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
  'RLS is enabled on every exposed table'
);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'owner-a@inout.test'),
  ('20000000-0000-0000-0000-000000000002', 'member-a@inout.test'),
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

select results_eq(
  'select name from public.households order by name',
  array['Household A'::text],
  'a user reads only households where they are a member'
);

select results_eq(
  'select name from public.accounts order by name',
  array['Account A'::text],
  'household-scoped rows from another household are hidden'
);

select lives_ok(
  $$
    insert into public.accounts (household_id, name, kind, created_by)
    values (
      'aaaaaaaa-0000-0000-0000-000000000001',
      'Owner A savings',
      'savings',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  'a member can write inside their household'
);

select throws_ok(
  $$
    insert into public.accounts (household_id, name, kind, created_by)
    values (
      'bbbbbbbb-0000-0000-0000-000000000002',
      'Cross-household account',
      'checking',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "accounts"',
  'cross-household inserts are rejected'
);

select results_eq(
  $$
    update public.accounts
    set name = 'Compromised'
    where id = 'b1000000-0000-0000-0000-000000000002'
    returning 1
  $$,
  $$ select 1 where false $$,
  'cross-household updates affect no rows'
);

select throws_ok(
  $$ select public.create_household_invite(
    'bbbbbbbb-0000-0000-0000-000000000002'
  ) $$,
  '42501',
  'only a household owner can create an invite',
  'an owner cannot manage membership in another household'
);

select throws_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values (
      'aaaaaaaa-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003',
      'member'
    )
  $$,
  '42501',
  'permission denied for table household_members',
  'membership cannot be inserted directly by a client'
);

select ok(
  length(public.create_household_invite(
    'aaaaaaaa-0000-0000-0000-000000000001'
  )) = 48,
  'an owner receives an opaque invite code'
);

create temporary table captured_invite (code text not null);
insert into captured_invite
select public.create_household_invite(
  'aaaaaaaa-0000-0000-0000-000000000001'
);

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';

select results_eq(
  $$
    select name
    from public.accept_household_invite((select code from captured_invite))
  $$,
  array['Household A'::text],
  'an authenticated user can accept a valid invite'
);

select results_eq(
  $$
    select count(*)
    from public.household_members
    where household_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  $$,
  array[2::bigint],
  'an accepted invite associates exactly two household members'
);

select results_eq(
  $$
    delete from public.household_members
    where household_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000001'
    returning 1
  $$,
  $$ select 1 where false $$,
  'a regular member cannot remove the household owner'
);

select throws_ok(
  $$ select public.create_household_invite(
    'aaaaaaaa-0000-0000-0000-000000000001'
  ) $$,
  '42501',
  'only a household owner can create an invite',
  'a regular member cannot create invites'
);

select throws_ok(
  $$ select public.accept_household_invite('not-a-valid-code') $$,
  '22023',
  'invalid or expired invite',
  'invalid invite codes fail closed'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  $$
    delete from public.household_members
    where household_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  'a household must retain at least one owner',
  'the final owner cannot remove themselves'
);

reset role;

select ok(
  not (select rolbypassrls from pg_roles where rolname = 'inout_api_runtime'),
  'the API runtime role cannot bypass RLS'
);

select ok(
  has_table_privilege('inout_api_runtime', 'public.household_members', 'select'),
  'the API runtime role can resolve household membership'
);

select ok(
  not has_table_privilege('inout_api_runtime', 'public.accounts', 'select'),
  'the identity slice cannot read financial accounts'
);

insert into auth.users (id, email)
values ('40000000-0000-0000-0000-000000000004', 'third-a@inout.test');

select throws_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values (
      'aaaaaaaa-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000004',
      'member'
    )
  $$,
  '23514',
  'household already has two members',
  'the database constraint rejects a third household member'
);

select * from finish();
rollback;
