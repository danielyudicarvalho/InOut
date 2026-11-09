-- Applied to the active project without the unrelated client-access revocations
-- in the older cutover migration. On a fresh database those policies may
-- already exist; keep this migration repeatable across both migration paths.
grant select, insert, update on public.accounts to inout_api_runtime;
grant select, insert, update on public.categories to inout_api_runtime;
grant select, insert, update on public.transactions to inout_api_runtime;
grant select, insert on public.entries to inout_api_runtime;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_select_api_member') then
    create policy accounts_select_api_member on public.accounts for select to inout_api_runtime using ((select private.is_household_member(household_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_select_api_member') then
    create policy categories_select_api_member on public.categories for select to inout_api_runtime using ((select private.is_household_member(household_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_select_api_member') then
    create policy transactions_select_api_member on public.transactions for select to inout_api_runtime using ((select private.is_household_member(household_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_insert_api_member') then
    create policy transactions_insert_api_member on public.transactions for insert to inout_api_runtime with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_update_api_member') then
    create policy transactions_update_api_member on public.transactions for update to inout_api_runtime using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entries' and policyname = 'entries_select_api_member') then
    create policy entries_select_api_member on public.entries for select to inout_api_runtime using ((select private.is_household_member(household_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entries' and policyname = 'entries_insert_api_member') then
    create policy entries_insert_api_member on public.entries for insert to inout_api_runtime with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
  end if;
end;
$$;
