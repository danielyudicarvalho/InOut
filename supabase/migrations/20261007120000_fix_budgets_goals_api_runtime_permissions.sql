-- Fix missing table privileges and RLS policies for inout_api_runtime on budgets, goals, recurring_plans, and forecasts.

grant select, insert, update, delete on table public.budgets to inout_api_runtime;
grant select, insert, update, delete on table public.goals to inout_api_runtime;
grant select, insert, update, delete on table public.recurring_plans to inout_api_runtime;
grant select, insert, update, delete on table public.forecasts to inout_api_runtime;

-- public.budgets
drop policy if exists budgets_insert_api_member on public.budgets;
create policy budgets_insert_api_member on public.budgets for insert to inout_api_runtime with check ((select private.is_household_member(household_id)));

drop policy if exists budgets_update_api_member on public.budgets;
create policy budgets_update_api_member on public.budgets for update to inout_api_runtime using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));

drop policy if exists budgets_delete_api_member on public.budgets;
create policy budgets_delete_api_member on public.budgets for delete to inout_api_runtime using ((select private.is_household_member(household_id)));

-- public.goals
drop policy if exists goals_insert_api_member on public.goals;
create policy goals_insert_api_member on public.goals for insert to inout_api_runtime with check ((select private.is_household_member(household_id)));

drop policy if exists goals_update_api_member on public.goals;
create policy goals_update_api_member on public.goals for update to inout_api_runtime using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));

drop policy if exists goals_delete_api_member on public.goals;
create policy goals_delete_api_member on public.goals for delete to inout_api_runtime using ((select private.is_household_member(household_id)));

-- public.recurring_plans
drop policy if exists recurring_plans_insert_api_member on public.recurring_plans;
create policy recurring_plans_insert_api_member on public.recurring_plans for insert to inout_api_runtime with check ((select private.is_household_member(household_id)));

drop policy if exists recurring_plans_update_api_member on public.recurring_plans;
create policy recurring_plans_update_api_member on public.recurring_plans for update to inout_api_runtime using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));

drop policy if exists recurring_plans_delete_api_member on public.recurring_plans;
create policy recurring_plans_delete_api_member on public.recurring_plans for delete to inout_api_runtime using ((select private.is_household_member(household_id)));

-- public.forecasts
drop policy if exists forecasts_insert_api_member on public.forecasts;
create policy forecasts_insert_api_member on public.forecasts for insert to inout_api_runtime with check ((select private.is_household_member(household_id)));

drop policy if exists forecasts_update_api_member on public.forecasts;
create policy forecasts_update_api_member on public.forecasts for update to inout_api_runtime using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));

drop policy if exists forecasts_delete_api_member on public.forecasts;
create policy forecasts_delete_api_member on public.forecasts for delete to inout_api_runtime using ((select private.is_household_member(household_id)));
