-- Fix missing table privileges and RLS policies for inout_api_runtime on budgets, goals, recurring_plans, and forecasts.

grant select on table public.budgets, public.goals, public.recurring_plans, public.forecasts to inout_api_runtime;

drop policy if exists budgets_select_api_member on public.budgets;
create policy budgets_select_api_member on public.budgets
  for select to inout_api_runtime
  using ((select private.is_household_member(household_id)));

drop policy if exists goals_select_api_member on public.goals;
create policy goals_select_api_member on public.goals
  for select to inout_api_runtime
  using ((select private.is_household_member(household_id)));

drop policy if exists recurring_plans_select_api_member on public.recurring_plans;
create policy recurring_plans_select_api_member on public.recurring_plans
  for select to inout_api_runtime
  using ((select private.is_household_member(household_id)));

drop policy if exists forecasts_select_api_member on public.forecasts;
create policy forecasts_select_api_member on public.forecasts
  for select to inout_api_runtime
  using ((select private.is_household_member(household_id)));
