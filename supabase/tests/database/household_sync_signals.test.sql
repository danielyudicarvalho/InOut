begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(10);

grant inout_api_runtime to postgres;
grant usage on schema extensions to inout_api_runtime;

select has_table(
  'public',
  'household_change_signals',
  'the household invalidation feed exists'
);

select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.household_change_signals'::regclass),
  'the invalidation feed has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.household_change_signals', 'select')
  and has_table_privilege('authenticated', 'public.household_change_signals', 'select')
  and not has_table_privilege('authenticated', 'public.household_change_signals', 'insert'),
  'clients can observe signals but cannot create them'
);

select ok(
  has_table_privilege('inout_api_runtime', 'public.household_change_signals', 'insert'),
  'the API runtime can emit transactional signals'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.can_receive_household_signal(uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.can_receive_household_signal(uuid)',
    'execute'
  ),
  'only authenticated clients can evaluate signal visibility'
);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'household_change_signals'
  ),
  'the signal feed is published through Supabase Realtime'
);

insert into auth.users (id, email) values
  ('91000000-0000-0000-0000-000000000001', 'sync-a@inout.test'),
  ('92000000-0000-0000-0000-000000000002', 'sync-b@inout.test');

insert into public.households (id, name, created_by) values
  ('93000000-0000-0000-0000-000000000003', 'Sync A', '91000000-0000-0000-0000-000000000001'),
  ('94000000-0000-0000-0000-000000000004', 'Sync B', '92000000-0000-0000-0000-000000000002');

insert into public.household_members (household_id, user_id, role) values
  ('93000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', 'owner'),
  ('94000000-0000-0000-0000-000000000004', '92000000-0000-0000-0000-000000000002', 'owner');

set local role inout_api_runtime;
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    insert into public.audit_events (
      household_id, actor_user_id, action, entity_type, entity_id
    ) values (
      '93000000-0000-0000-0000-000000000003',
      '91000000-0000-0000-0000-000000000001',
      'financial.transaction.posted',
      'transaction',
      '95000000-0000-0000-0000-000000000005'
    )
  $$,
  'an audited API mutation emits its signal in the same transaction'
);

reset role;

select results_eq(
  $$
    select household_id
    from public.household_change_signals
    order by revision
  $$,
  array['93000000-0000-0000-0000-000000000003'::uuid],
  'the trigger emits one signal for the changed household'
);

set local role inout_api_runtime;
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000001';

select throws_ok(
  $$
    insert into public.household_change_signals (household_id)
    values ('94000000-0000-0000-0000-000000000004')
  $$,
  '42501',
  'new row violates row-level security policy for table "household_change_signals"',
  'the API runtime cannot signal another household'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000001';

select results_eq(
  'select household_id from public.household_change_signals order by revision',
  array['93000000-0000-0000-0000-000000000003'::uuid],
  'a client observes only signals from its household'
);

select * from finish();
rollback;
