alter table public.transactions
drop constraint if exists transactions_kind_check;

alter table public.transactions
add constraint transactions_kind_check
check (kind in ('opening_balance', 'income', 'expense', 'transfer', 'reversal'));

grant insert, update on table public.accounts to inout_api_runtime;

create policy accounts_insert_api_member on public.accounts
for insert to inout_api_runtime
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);

create policy accounts_update_api_member on public.accounts
for update to inout_api_runtime
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
