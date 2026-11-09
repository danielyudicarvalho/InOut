-- Fix missing table UPDATE privilege and RLS policy for inout_api_runtime on public.households for row locking (SELECT ... FOR UPDATE)

grant select, insert, update on table public.households to inout_api_runtime;

drop policy if exists households_update_api_owner on public.households;
create policy households_update_api_owner
on public.households
for update to inout_api_runtime
using ((select private.is_household_owner(id)))
with check ((select private.is_household_owner(id)));
