-- GOM-101: make the ASP.NET API the only business-data boundary.
-- The legacy functions remain installed for a time-bounded emergency rollback,
-- but no public client role can execute them.

grant select on table public.accounts, public.categories to inout_api_runtime;
grant select, insert, update on table public.transactions to inout_api_runtime;
grant select, insert on table public.entries to inout_api_runtime;

create policy accounts_select_api_member on public.accounts
for select to inout_api_runtime
using ((select private.is_household_member(household_id)));

create policy categories_select_api_member on public.categories
for select to inout_api_runtime
using ((select private.is_household_member(household_id)));

create policy transactions_select_api_member on public.transactions
for select to inout_api_runtime
using ((select private.is_household_member(household_id)));

create policy transactions_insert_api_member on public.transactions
for insert to inout_api_runtime
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);

create policy transactions_update_api_member on public.transactions
for update to inout_api_runtime
using ((select private.is_household_member(household_id)))
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);

create policy entries_select_api_member on public.entries
for select to inout_api_runtime
using ((select private.is_household_member(household_id)));

create policy entries_insert_api_member on public.entries
for insert to inout_api_runtime
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);

revoke all on table
  public.households,
  public.household_members,
  public.accounts,
  public.categories,
  public.transactions,
  public.entries,
  public.budgets,
  public.goals,
  public.audit_events
from anon, authenticated;

revoke execute on function public.create_household(text) from public, anon, authenticated;
revoke execute on function public.create_household_invite(uuid) from public, anon, authenticated;
revoke execute on function public.accept_household_invite(text) from public, anon, authenticated;
revoke usage on schema private from anon, authenticated;
