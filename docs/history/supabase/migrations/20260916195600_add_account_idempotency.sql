alter table public.accounts
  add column if not exists idempotency_key uuid;

create unique index if not exists accounts_household_idempotency_key_uidx
  on public.accounts (household_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.accounts.idempotency_key is
  'Identifies a create-account command so retries return the original account.';
