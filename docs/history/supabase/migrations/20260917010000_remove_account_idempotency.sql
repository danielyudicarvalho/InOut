drop index if exists public.accounts_household_idempotency_key_uidx;

alter table public.accounts
  drop column if exists idempotency_key;
