grant select on table public.budgets, public.goals to inout_api_runtime;

create policy budgets_select_api_member
on public.budgets
for select
to inout_api_runtime
using ((select private.is_household_member(household_id)));

create policy goals_select_api_member
on public.goals
for select
to inout_api_runtime
using ((select private.is_household_member(household_id)));
