create table private.idempotency_requests (
  tenant_id uuid not null references public.households (id) on delete cascade,
  operation text not null check (char_length(btrim(operation)) between 1 and 100),
  idempotency_key uuid not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('processing', 'completed', 'failed_retryable', 'failed_final')),
  response_code integer check (response_code between 100 and 599),
  response_body jsonb,
  resource_type text check (resource_type is null or char_length(btrim(resource_type)) between 1 and 100),
  resource_id uuid,
  attempt_count integer not null default 1 check (attempt_count > 0),
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null,
  last_error_code text,
  primary key (tenant_id, operation, idempotency_key),
  check (expires_at > created_at),
  check (
    (status = 'completed' and response_code is not null and response_body is not null and completed_at is not null)
    or status <> 'completed'
  )
);

create index idempotency_requests_expiry_idx
  on private.idempotency_requests (expires_at);

create index idempotency_requests_processing_lease_idx
  on private.idempotency_requests (locked_until)
  where status in ('processing', 'failed_retryable');

create table private.outbox_messages (
  id uuid primary key,
  tenant_id uuid not null references public.households (id) on delete cascade,
  aggregate_type text not null check (char_length(btrim(aggregate_type)) between 1 and 100),
  aggregate_id uuid not null,
  aggregate_version bigint not null check (aggregate_version > 0),
  event_type text not null check (char_length(btrim(event_type)) between 1 and 150),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default now(),
  published_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  constraint outbox_messages_aggregate_version_key
    unique (aggregate_type, aggregate_id, aggregate_version)
);

create index outbox_messages_pending_idx
  on private.outbox_messages (occurred_at, id)
  where published_at is null;

create table private.inbox_messages (
  consumer text not null check (char_length(btrim(consumer)) between 1 and 150),
  message_id uuid not null,
  tenant_id uuid not null references public.households (id) on delete cascade,
  message_fingerprint text not null check (message_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('processing', 'processed', 'failed_retryable', 'failed_final')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (consumer, message_id),
  check ((status = 'processed' and processed_at is not null) or status <> 'processed')
);

create index inbox_messages_tenant_received_idx
  on private.inbox_messages (tenant_id, received_at desc);

alter table private.idempotency_requests enable row level security;
alter table private.outbox_messages enable row level security;
alter table private.inbox_messages enable row level security;

create policy idempotency_requests_select_api_member
on private.idempotency_requests
for select to inout_api_runtime
using ((select private.is_household_member(tenant_id)));

create policy idempotency_requests_insert_api_actor
on private.idempotency_requests
for insert to inout_api_runtime
with check (
  actor_user_id = (select auth.uid())
  and (select private.is_household_member(tenant_id))
);

create policy idempotency_requests_update_api_actor
on private.idempotency_requests
for update to inout_api_runtime
using (
  actor_user_id = (select auth.uid())
  and (select private.is_household_member(tenant_id))
)
with check (
  actor_user_id = (select auth.uid())
  and (select private.is_household_member(tenant_id))
);

create policy outbox_messages_api_member
on private.outbox_messages
for all to inout_api_runtime
using ((select private.is_household_member(tenant_id)))
with check ((select private.is_household_member(tenant_id)));

create policy inbox_messages_api_member
on private.inbox_messages
for all to inout_api_runtime
using ((select private.is_household_member(tenant_id)))
with check ((select private.is_household_member(tenant_id)));

revoke all on table
  private.idempotency_requests,
  private.outbox_messages,
  private.inbox_messages
from public, anon, authenticated;

grant select, insert, update on table
  private.idempotency_requests,
  private.outbox_messages,
  private.inbox_messages
to inout_api_runtime;

alter table public.transactions
  add column opening_account_id uuid;

update public.transactions transaction
set opening_account_id = opening.account_id
from (
  select distinct on (household_id, transaction_id)
    household_id,
    transaction_id,
    account_id
  from public.entries
  order by household_id, transaction_id, id
) opening
where transaction.kind = 'opening_balance'
  and opening.household_id = transaction.household_id
  and opening.transaction_id = transaction.id;

alter table public.transactions
  add constraint transactions_opening_account_kind_ck check (
    (kind = 'opening_balance' and opening_account_id is not null)
    or (kind <> 'opening_balance' and opening_account_id is null)
  ),
  add constraint transactions_opening_account_fk
    foreign key (household_id, opening_account_id)
    references public.accounts (household_id, id);

create unique index transactions_one_opening_balance_per_account_uidx
  on public.transactions (household_id, opening_account_id)
  where kind = 'opening_balance';

create unique index transactions_one_reversal_per_original_uidx
  on public.transactions (household_id, reversal_of)
  where kind = 'reversal';

-- Preserve at-most-once safety during the migration from transaction-scoped
-- keys. The old request payload cannot be reconstructed reliably, therefore a
-- retry with a legacy key fails closed instead of risking a duplicate write.
insert into private.idempotency_requests (
  tenant_id,
  operation,
  idempotency_key,
  actor_user_id,
  request_fingerprint,
  status,
  attempt_count,
  locked_until,
  created_at,
  updated_at,
  expires_at,
  last_error_code
)
select
  household_id,
  case kind
    when 'income' then 'post_income'
    when 'expense' then 'post_expense'
    when 'transfer' then 'post_transfer'
    when 'reversal' then 'reverse_transaction'
    else 'create_account'
  end,
  idempotency_key,
  created_by,
  repeat('0', 64),
  'failed_final',
  1,
  now(),
  created_at,
  now(),
  greatest(now() + interval '90 days', created_at + interval '90 days'),
  'legacy_fingerprint_unavailable'
from public.transactions
where idempotency_key is not null
on conflict (tenant_id, operation, idempotency_key) do nothing;

alter table public.transactions
  drop constraint if exists transactions_household_id_idempotency_key_key,
  drop column if exists idempotency_key;
