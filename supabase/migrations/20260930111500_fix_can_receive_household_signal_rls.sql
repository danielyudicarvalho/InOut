-- Fix can_receive_household_signal RLS helper for Supabase Realtime
create or replace function public.can_receive_household_signal(requested_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_household_member(requested_household_id);
$$;

grant execute on function public.can_receive_household_signal(uuid) to authenticated, inout_api_runtime;
grant select on table public.household_change_signals to authenticated, inout_api_runtime;
