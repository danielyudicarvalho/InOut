begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(5);

grant inout_api_runtime to postgres;
grant usage on schema extensions to inout_api_runtime;

select ok(
  has_table_privilege('inout_api_runtime', 'public.accounts', 'select,insert,update')
  and not has_table_privilege('inout_api_runtime', 'public.accounts', 'delete'),
  'the API runtime manages account lifecycle without delete'
);

insert into auth.users (id, email)
values ('81000000-0000-0000-0000-000000000001', 'accounts-owner@inout.test');
insert into public.households (id, name, created_by)
values (
  '82000000-0000-0000-0000-000000000001',
  'Accounts household',
  '81000000-0000-0000-0000-000000000001'
);
insert into public.household_members (household_id, user_id, role)
values (
  '82000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  'owner'
);

set local role inout_api_runtime;
set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    insert into public.accounts (id, household_id, name, kind, currency, created_by)
    values (
      '83000000-0000-0000-0000-000000000001',
      '82000000-0000-0000-0000-000000000001',
      'Reserva',
      'savings',
      'BRL',
      '81000000-0000-0000-0000-000000000001'
    )
  $$,
  'the API runtime creates an account for the authenticated household'
);

select lives_ok(
  $$
    update public.accounts
    set archived_at = now()
    where id = '83000000-0000-0000-0000-000000000001'
  $$,
  'the API runtime archives rather than deletes an account'
);

select throws_ok(
  $$ delete from public.accounts where id = '83000000-0000-0000-0000-000000000001' $$,
  '42501',
  'permission denied for table accounts',
  'the API runtime cannot delete accounts'
);

select lives_ok(
  $$
    insert into public.transactions (
      household_id, kind, status, description, occurred_on,
      opening_account_id, created_by, posted_at
    ) values (
      '82000000-0000-0000-0000-000000000001',
      'opening_balance',
      'posted',
      'Saldo inicial',
      current_date,
      '83000000-0000-0000-0000-000000000001',
      '81000000-0000-0000-0000-000000000001',
      now()
    )
  $$,
  'opening balance is an explicit supported transaction kind'
);

select * from finish();
rollback;
