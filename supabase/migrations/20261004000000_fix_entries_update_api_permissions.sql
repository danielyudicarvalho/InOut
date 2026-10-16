-- Fix missing UPDATE privileges and RLS policies for inout_api_runtime on public.entries and public.transactions for classification correction (UC-COR-001)

grant select, insert, update on table public.entries to inout_api_runtime;
grant select, insert, update on table public.transactions to inout_api_runtime;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entries' and policyname = 'entries_update_api_member') then
    create policy entries_update_api_member on public.entries for update to inout_api_runtime using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_update_api_member') then
    create policy transactions_update_api_member on public.transactions for update to inout_api_runtime using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));
  else
    drop policy transactions_update_api_member on public.transactions;
    create policy transactions_update_api_member on public.transactions for update to inout_api_runtime using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));
  end if;
end;
$$;
