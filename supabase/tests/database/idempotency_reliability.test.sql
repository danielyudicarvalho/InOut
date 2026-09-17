begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(10);

select ok(
  has_table_privilege('inout_api_runtime', 'private.idempotency_requests', 'select,insert,update')
  and not has_table_privilege('anon', 'private.idempotency_requests', 'select')
  and not has_table_privilege('authenticated', 'private.idempotency_requests', 'select'),
  'idempotency storage is private and only available to the API runtime'
);

select ok(
  has_table_privilege('inout_api_runtime', 'private.outbox_messages', 'select,insert,update')
  and has_table_privilege('inout_api_runtime', 'private.inbox_messages', 'select,insert,update'),
  'runtime has the least privileges required for outbox and inbox processing'
);

select col_is_pk(
  'private',
  'idempotency_requests',
  array['tenant_id', 'operation', 'idempotency_key'],
  'tenant, operation and key are the atomic idempotency scope'
);

select col_is_pk(
  'private',
  'inbox_messages',
  array['consumer', 'message_id'],
  'each consumer deduplicates messages independently'
);

select has_index(
  'private',
  'outbox_messages',
  'outbox_messages_aggregate_version_key',
  'outbox ordering is unique per aggregate version'
);

select has_index(
  'public',
  'transactions',
  'transactions_one_opening_balance_per_account_uidx',
  'opening balance uniqueness is independent from idempotency'
);

select has_index(
  'public',
  'transactions',
  'transactions_one_reversal_per_original_uidx',
  'reversal uniqueness is independent from idempotency'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'private.idempotency_requests'::regclass),
  'idempotency requests have RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'private.outbox_messages'::regclass),
  'outbox has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'private.inbox_messages'::regclass),
  'inbox has RLS enabled'
);

select * from finish();
rollback;
