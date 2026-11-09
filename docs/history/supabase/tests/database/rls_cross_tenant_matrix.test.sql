-- QA: cross-tenant RLS / authorization matrix for every financial table.
-- Personas: A1 (owner of household A), A2 (member of A), B1 (sole owner of B),
-- O (authenticated, no household). Covers inout_api_runtime + private.auth_uid(),
-- direct authenticated access, anon, and a missing JWT subject.
-- Every probe write is rolled back, so one leak cannot mask another check.
-- Known failures on origin/main (2026-10-30), kept red on purpose until fixed:
--   * household_members_insert_api_self has no household guard: any API user
--     can insert itself as owner/member of any household with < 2 members.
--   * goals/budgets/recurring_plans/forecasts have a second permissive INSERT
--     policy without the created_by check, so created_by can be spoofed.
--   * status_types/status_values keep Supabase default write/truncate grants
--     for anon/authenticated (RLS and FKs block the writes today).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select no_plan();

grant inout_api_runtime to postgres;
grant usage on schema extensions to inout_api_runtime;

-- Runs a statement as the current role and returns affected rows; a privilege
-- error counts as 0 rows (the write was refused). Changes are always rolled back.
create function pg_temp.affected(statement text) returns integer
language plpgsql as $f$
declare n integer;
begin
  begin
    execute statement;
    get diagnostics n = row_count;
    -- Always roll the probe back so one leak cannot contaminate later checks.
    raise exception using errcode = 'QA001', message = n::text;
  exception
    when insufficient_privilege then return 0;
    when sqlstate 'QA001' then return sqlerrm::integer;
  end;
end;
$f$;
grant execute on function pg_temp.affected(text) to public;

-- Returns the SQLSTATE raised by a statement, or 'ok' when it succeeded.
create function pg_temp.sqlstate_of(statement text) returns text
language plpgsql as $f$
begin
  execute statement;
  -- Roll the probe back even when it succeeds.
  raise exception using errcode = 'QA001';
exception when others then
  return case when sqlstate = 'QA001' then 'ok' else sqlstate end;
end;
$f$;
grant execute on function pg_temp.sqlstate_of(text) to public;

insert into auth.users (id, email) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'a1@inout.test'), ('a2a2a2a2-0000-0000-0000-000000000002', 'a2@inout.test'),
  ('b1b1b1b1-0000-0000-0000-000000000001', 'b1@inout.test'), ('0e0e0e0e-0000-0000-0000-000000000001', 'outsider@inout.test');
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Household A', 'a1a1a1a1-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-00000000000b', 'Household B', 'b1b1b1b1-0000-0000-0000-000000000001');
insert into public.household_members (household_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a1a1a1a1-0000-0000-0000-000000000001', 'owner'), ('aaaaaaaa-0000-0000-0000-00000000000a', 'a2a2a2a2-0000-0000-0000-000000000002', 'member'), ('bbbbbbbb-0000-0000-0000-00000000000b', 'b1b1b1b1-0000-0000-0000-000000000001', 'owner');
insert into public.accounts (id, household_id, name, kind, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Account a', 'checking', 'a1a1a1a1-0000-0000-0000-000000000001');
insert into public.categories (id, household_id, name, flow, created_by) values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Salary a', 'income', 'a1a1a1a1-0000-0000-0000-000000000001');
insert into public.income_sources (id, household_id, name, created_by) values ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Employer a', 'a1a1a1a1-0000-0000-0000-000000000001');
insert into public.transactions (id, household_id, kind, status, occurred_on, created_by, posted_at) values ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', 'income', 'posted', current_date, 'a1a1a1a1-0000-0000-0000-000000000001', now());
insert into public.entries (household_id, transaction_id, account_id, direction, amount_cents, created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'credit', 1000, 'a1a1a1a1-0000-0000-0000-000000000001');
insert into public.budgets (household_id, category_id, period_start, period_end, limit_cents, created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', current_date, current_date, 500, 'a1a1a1a1-0000-0000-0000-000000000001');
insert into public.goals (household_id, name, target_cents, created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Goal a', 500, 'a1a1a1a1-0000-0000-0000-000000000001');
insert into public.recurring_plans (id, household_id, name, flow, account_id, category_id, amount_cents, currency, day_of_month, starts_on, created_by) values ('aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Plan a', 'income', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 1000, 'BRL', 5, current_date, 'a1a1a1a1-0000-0000-0000-000000000001');
insert into public.forecasts (id, household_id, account_id, currency, as_of, months, opening_balance_cents, points, calculated_at, created_by) values ('aaaaaaaa-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'BRL', current_date, 1, 0, '[]', now(), 'a1a1a1a1-0000-0000-0000-000000000001');
insert into public.audit_events (household_id, actor_user_id, action, entity_type, outcome) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a1a1a1a1-0000-0000-0000-000000000001', 'qa.seed', 'household', 'success');
insert into public.accounts (id, household_id, name, kind, created_by) values ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Account b', 'checking', 'b1b1b1b1-0000-0000-0000-000000000001');
insert into public.categories (id, household_id, name, flow, created_by) values ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Salary b', 'income', 'b1b1b1b1-0000-0000-0000-000000000001');
insert into public.income_sources (id, household_id, name, created_by) values ('bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Employer b', 'b1b1b1b1-0000-0000-0000-000000000001');
insert into public.transactions (id, household_id, kind, status, occurred_on, created_by, posted_at) values ('bbbbbbbb-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-00000000000b', 'income', 'posted', current_date, 'b1b1b1b1-0000-0000-0000-000000000001', now());
insert into public.entries (household_id, transaction_id, account_id, direction, amount_cents, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'credit', 1000, 'b1b1b1b1-0000-0000-0000-000000000001');
insert into public.budgets (household_id, category_id, period_start, period_end, limit_cents, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', current_date, current_date, 500, 'b1b1b1b1-0000-0000-0000-000000000001');
insert into public.goals (household_id, name, target_cents, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'Goal b', 500, 'b1b1b1b1-0000-0000-0000-000000000001');
insert into public.recurring_plans (id, household_id, name, flow, account_id, category_id, amount_cents, currency, day_of_month, starts_on, created_by) values ('bbbbbbbb-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Plan b', 'income', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1000, 'BRL', 5, current_date, 'b1b1b1b1-0000-0000-0000-000000000001');
insert into public.forecasts (id, household_id, account_id, currency, as_of, months, opening_balance_cents, points, calculated_at, created_by) values ('bbbbbbbb-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'BRL', current_date, 1, 0, '[]', now(), 'b1b1b1b1-0000-0000-0000-000000000001');
insert into public.audit_events (household_id, actor_user_id, action, entity_type, outcome) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'b1b1b1b1-0000-0000-0000-000000000001', 'qa.seed', 'household', 'success');
insert into public.household_change_signals (household_id) select id from public.households where not exists (select 1 from public.household_change_signals s where s.household_id = households.id);

-- anon and direct authenticated clients
select ok(not has_table_privilege('anon', 'public.accounts', 'select,insert,update,delete,truncate'), 'anon has no privilege on accounts');
select ok(not has_table_privilege('anon', 'public.categories', 'select,insert,update,delete,truncate'), 'anon has no privilege on categories');
select ok(not has_table_privilege('anon', 'public.transactions', 'select,insert,update,delete,truncate'), 'anon has no privilege on transactions');
select ok(not has_table_privilege('anon', 'public.entries', 'select,insert,update,delete,truncate'), 'anon has no privilege on entries');
select ok(not has_table_privilege('anon', 'public.budgets', 'select,insert,update,delete,truncate'), 'anon has no privilege on budgets');
select ok(not has_table_privilege('anon', 'public.goals', 'select,insert,update,delete,truncate'), 'anon has no privilege on goals');
select ok(not has_table_privilege('anon', 'public.income_sources', 'select,insert,update,delete,truncate'), 'anon has no privilege on income_sources');
select ok(not has_table_privilege('anon', 'public.recurring_plans', 'select,insert,update,delete,truncate'), 'anon has no privilege on recurring_plans');
select ok(not has_table_privilege('anon', 'public.forecasts', 'select,insert,update,delete,truncate'), 'anon has no privilege on forecasts');
select ok(not has_table_privilege('anon', 'public.audit_events', 'select,insert,update,delete,truncate'), 'anon has no privilege on audit_events');
select ok(not has_table_privilege('anon', 'public.household_change_signals', 'select,insert,update,delete,truncate'), 'anon has no privilege on household_change_signals');
select ok(not has_table_privilege('anon', 'public.households', 'select,insert,update,delete,truncate'), 'anon has no privilege on households');
select ok(not has_table_privilege('anon', 'public.household_members', 'select,insert,update,delete,truncate'), 'anon has no privilege on household_members');
select ok(not has_table_privilege('anon', 'public.status_types', 'insert,update,delete,truncate'), 'anon cannot write or truncate lookup table status_types');
select ok(not has_table_privilege('authenticated', 'public.status_types', 'insert,update,delete,truncate'), 'authenticated cannot write or truncate lookup table status_types');
select ok(not has_table_privilege('anon', 'public.status_values', 'insert,update,delete,truncate'), 'anon cannot write or truncate lookup table status_values');
select ok(not has_table_privilege('authenticated', 'public.status_values', 'insert,update,delete,truncate'), 'authenticated cannot write or truncate lookup table status_values');
select ok(not has_table_privilege('inout_api_runtime', 'public.accounts', 'truncate'), 'runtime cannot truncate accounts');
select ok(not has_table_privilege('inout_api_runtime', 'public.categories', 'truncate'), 'runtime cannot truncate categories');
select ok(not has_table_privilege('inout_api_runtime', 'public.transactions', 'truncate'), 'runtime cannot truncate transactions');
select ok(not has_table_privilege('inout_api_runtime', 'public.entries', 'truncate'), 'runtime cannot truncate entries');
select ok(not has_table_privilege('inout_api_runtime', 'public.budgets', 'truncate'), 'runtime cannot truncate budgets');
select ok(not has_table_privilege('inout_api_runtime', 'public.goals', 'truncate'), 'runtime cannot truncate goals');
select ok(not has_table_privilege('inout_api_runtime', 'public.income_sources', 'truncate'), 'runtime cannot truncate income_sources');
select ok(not has_table_privilege('inout_api_runtime', 'public.recurring_plans', 'truncate'), 'runtime cannot truncate recurring_plans');
select ok(not has_table_privilege('inout_api_runtime', 'public.forecasts', 'truncate'), 'runtime cannot truncate forecasts');
select ok(not has_table_privilege('inout_api_runtime', 'public.audit_events', 'truncate'), 'runtime cannot truncate audit_events');
select ok(not has_table_privilege('inout_api_runtime', 'public.household_change_signals', 'truncate'), 'runtime cannot truncate household_change_signals');
select ok(not has_table_privilege('inout_api_runtime', 'public.households', 'truncate'), 'runtime cannot truncate households');
select ok(not has_table_privilege('inout_api_runtime', 'public.household_members', 'truncate'), 'runtime cannot truncate household_members');
select ok(not (select rolbypassrls from pg_roles where rolname = 'inout_api_runtime'), 'runtime does not bypass RLS');
select ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity), 'every public table has RLS enabled');

set local role inout_api_runtime;
set local request.jwt.claims = '';
set local request.jwt.claim.sub = 'a1a1a1a1-0000-0000-0000-000000000001';
select is(private.auth_uid(), 'a1a1a1a1-0000-0000-0000-000000000001'::uuid, 'private.auth_uid() resolves the request subject');
select is((select count(*) from public.accounts where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B accounts');
select ok((select count(*) from public.accounts where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household accounts (positive control)');
select is((select count(*) from public.categories where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B categories');
select ok((select count(*) from public.categories where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household categories (positive control)');
select is((select count(*) from public.transactions where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B transactions');
select ok((select count(*) from public.transactions where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household transactions (positive control)');
select is((select count(*) from public.entries where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B entries');
select ok((select count(*) from public.entries where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household entries (positive control)');
select is((select count(*) from public.budgets where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B budgets');
select ok((select count(*) from public.budgets where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household budgets (positive control)');
select is((select count(*) from public.goals where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B goals');
select ok((select count(*) from public.goals where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household goals (positive control)');
select is((select count(*) from public.income_sources where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B income_sources');
select ok((select count(*) from public.income_sources where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household income_sources (positive control)');
select is((select count(*) from public.recurring_plans where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B recurring_plans');
select ok((select count(*) from public.recurring_plans where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household recurring_plans (positive control)');
select is((select count(*) from public.forecasts where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B forecasts');
select ok((select count(*) from public.forecasts where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household forecasts (positive control)');
select is((select count(*) from public.audit_events where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B audit_events');
select ok((select count(*) from public.audit_events where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household audit_events (positive control)');
select is((select count(*) from public.household_change_signals where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B household_change_signals');
select is((select count(*) from public.households where id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B households');
select ok((select count(*) from public.households where id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household households (positive control)');
select is((select count(*) from public.household_members where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'runtime A1 cannot read household B household_members');
select ok((select count(*) from public.household_members where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0, 'runtime A1 reads own household household_members (positive control)');
select is(pg_temp.affected($$ update public.accounts set name = 'pwned' where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B accounts');
select is(pg_temp.affected($$ delete from public.accounts where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B accounts');
select is(pg_temp.affected($$ update public.categories set name = 'pwned' where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B categories');
select is(pg_temp.affected($$ delete from public.categories where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B categories');
select is(pg_temp.affected($$ update public.transactions set description = 'pwned' where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B transactions');
select is(pg_temp.affected($$ delete from public.transactions where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B transactions');
select is(pg_temp.affected($$ update public.entries set amount_cents = 1 where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B entries');
select is(pg_temp.affected($$ delete from public.entries where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B entries');
select is(pg_temp.affected($$ update public.budgets set limit_cents = 1 where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B budgets');
select is(pg_temp.affected($$ delete from public.budgets where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B budgets');
select is(pg_temp.affected($$ update public.goals set target_cents = 1 where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B goals');
select is(pg_temp.affected($$ delete from public.goals where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B goals');
select is(pg_temp.affected($$ update public.income_sources set name = 'pwned' where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B income_sources');
select is(pg_temp.affected($$ delete from public.income_sources where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B income_sources');
select is(pg_temp.affected($$ update public.recurring_plans set amount_cents = 1 where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B recurring_plans');
select is(pg_temp.affected($$ delete from public.recurring_plans where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B recurring_plans');
select is(pg_temp.affected($$ update public.forecasts set months = 2 where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B forecasts');
select is(pg_temp.affected($$ delete from public.forecasts where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B forecasts');
select is(pg_temp.affected($$ update public.audit_events set action = 'pwned' where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B audit_events');
select is(pg_temp.affected($$ delete from public.audit_events where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B audit_events');
select is(pg_temp.affected($$ update public.household_change_signals set changed_at = now() where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B household_change_signals');
select is(pg_temp.affected($$ delete from public.household_change_signals where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B household_change_signals');
select is(pg_temp.affected($$ update public.households set name = 'pwned' where id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B households');
select is(pg_temp.affected($$ delete from public.households where id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B households');
select is(pg_temp.affected($$ update public.household_members set role = 'member' where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot update household B household_members');
select is(pg_temp.affected($$ delete from public.household_members where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'runtime A1 cannot delete household B household_members');
select isnt(pg_temp.sqlstate_of($$ update public.accounts set household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$), 'ok', 'runtime A1 cannot move own accounts into household B');
select isnt(pg_temp.sqlstate_of($$ update public.categories set household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$), 'ok', 'runtime A1 cannot move own categories into household B');
select isnt(pg_temp.sqlstate_of($$ update public.transactions set household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$), 'ok', 'runtime A1 cannot move own transactions into household B');
select isnt(pg_temp.sqlstate_of($$ update public.entries set household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$), 'ok', 'runtime A1 cannot move own entries into household B');
select isnt(pg_temp.sqlstate_of($$ update public.budgets set household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$), 'ok', 'runtime A1 cannot move own budgets into household B');
select isnt(pg_temp.sqlstate_of($$ update public.goals set household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$), 'ok', 'runtime A1 cannot move own goals into household B');
select isnt(pg_temp.sqlstate_of($$ update public.income_sources set household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$), 'ok', 'runtime A1 cannot move own income_sources into household B');
select isnt(pg_temp.sqlstate_of($$ update public.recurring_plans set household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$), 'ok', 'runtime A1 cannot move own recurring_plans into household B');
select isnt(pg_temp.sqlstate_of($$ update public.forecasts set household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$), 'ok', 'runtime A1 cannot move own forecasts into household B');
select is(pg_temp.sqlstate_of($$insert into public.accounts (household_id, name, kind, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'x', 'cash', 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime A1 cannot insert accounts into household B');
select is(pg_temp.sqlstate_of($$insert into public.categories (household_id, name, flow, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'x', 'expense', 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime A1 cannot insert categories into household B');
select is(pg_temp.sqlstate_of($$insert into public.transactions (household_id, kind, occurred_on, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'expense', current_date, 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime A1 cannot insert transactions into household B');
select is(pg_temp.sqlstate_of($$insert into public.entries (household_id, transaction_id, account_id, direction, amount_cents, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'debit', 1, 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime A1 cannot insert entries into household B');
select is(pg_temp.sqlstate_of($$insert into public.budgets (household_id, category_id, period_start, period_end, limit_cents, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', current_date + 40, current_date + 40, 1, 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime A1 cannot insert budgets into household B');
select is(pg_temp.sqlstate_of($$insert into public.goals (household_id, name, target_cents, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'x', 1, 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime A1 cannot insert goals into household B');
select is(pg_temp.sqlstate_of($$insert into public.income_sources (household_id, name, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'x', 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime A1 cannot insert income_sources into household B');
select is(pg_temp.sqlstate_of($$insert into public.recurring_plans (id, household_id, name, flow, account_id, category_id, amount_cents, currency, day_of_month, starts_on, created_by) values (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-00000000000b', 'x', 'income', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1, 'BRL', 1, current_date, 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime A1 cannot insert recurring_plans into household B');
select is(pg_temp.sqlstate_of($$insert into public.forecasts (id, household_id, account_id, currency, as_of, months, opening_balance_cents, points, calculated_at, created_by) values (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'BRL', current_date, 1, 0, '[]', now(), 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime A1 cannot insert forecasts into household B');
select is(pg_temp.sqlstate_of($$insert into public.audit_events (household_id, actor_user_id, action, entity_type, outcome) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'a1a1a1a1-0000-0000-0000-000000000001', 'x', 'household', 'success')$$), '42501', 'runtime A1 cannot insert audit_events into household B');
select is(pg_temp.sqlstate_of($$insert into public.household_change_signals (household_id) values ('bbbbbbbb-0000-0000-0000-00000000000b')$$), '42501', 'runtime A1 cannot insert household_change_signals into household B');
select is(pg_temp.sqlstate_of($$ insert into public.household_members (household_id, user_id, role) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'a1a1a1a1-0000-0000-0000-000000000001', 'owner') $$), '42501', 'runtime A1 cannot add itself as owner of household B without an invite');
select is(pg_temp.sqlstate_of($$ insert into public.household_members (household_id, user_id, role) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'a1a1a1a1-0000-0000-0000-000000000001', 'member') $$), '42501', 'runtime A1 cannot add itself as member of household B without an invite');
select is(pg_temp.sqlstate_of($$ insert into public.household_members (household_id, user_id, role) values ('bbbbbbbb-0000-0000-0000-00000000000b', '0e0e0e0e-0000-0000-0000-000000000001', 'member') $$), '42501', 'runtime A1 cannot add another user to a household');
select is(pg_temp.sqlstate_of($$insert into public.accounts (household_id, name, kind, created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'spoof', 'cash', 'a2a2a2a2-0000-0000-0000-000000000002')$$), '42501', 'runtime A1 cannot attribute a accounts row to another user (created_by spoof)');
select is(pg_temp.sqlstate_of($$insert into public.transactions (household_id, kind, occurred_on, created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'expense', current_date, 'a2a2a2a2-0000-0000-0000-000000000002')$$), '42501', 'runtime A1 cannot attribute a transactions row to another user (created_by spoof)');
select is(pg_temp.sqlstate_of($$insert into public.goals (household_id, name, target_cents, created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'spoof', 1, 'a2a2a2a2-0000-0000-0000-000000000002')$$), '42501', 'runtime A1 cannot attribute a goals row to another user (created_by spoof)');
select is(pg_temp.sqlstate_of($$insert into public.budgets (household_id, category_id, period_start, period_end, limit_cents, created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', current_date + 80, current_date + 80, 1, 'a2a2a2a2-0000-0000-0000-000000000002')$$), '42501', 'runtime A1 cannot attribute a budgets row to another user (created_by spoof)');
select is(pg_temp.sqlstate_of($$insert into public.recurring_plans (id, household_id, name, flow, account_id, category_id, amount_cents, currency, day_of_month, starts_on, created_by) values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-00000000000a', 'spoof', 'income', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 1, 'BRL', 1, current_date, 'a2a2a2a2-0000-0000-0000-000000000002')$$), '42501', 'runtime A1 cannot attribute a recurring_plans row to another user (created_by spoof)');
select is(pg_temp.sqlstate_of($$insert into public.forecasts (id, household_id, account_id, currency, as_of, months, opening_balance_cents, points, calculated_at, created_by) values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'BRL', current_date, 1, 0, '[]', now(), 'a2a2a2a2-0000-0000-0000-000000000002')$$), '42501', 'runtime A1 cannot attribute a forecasts row to another user (created_by spoof)');
select is(pg_temp.sqlstate_of($$insert into public.audit_events (household_id, actor_user_id, action, entity_type, outcome) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a2a2a2a2-0000-0000-0000-000000000002', 'spoof', 'household', 'success')$$), '42501', 'runtime A1 cannot attribute a audit_events row to another user (created_by spoof)');

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"sub":"b1b1b1b1-0000-0000-0000-000000000001"}';
select is(private.auth_uid(), 'b1b1b1b1-0000-0000-0000-000000000001'::uuid, 'private.auth_uid() falls back to request.jwt.claims');
select is((select count(*) from public.accounts where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A accounts');
select is((select count(*) from public.categories where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A categories');
select is((select count(*) from public.transactions where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A transactions');
select is((select count(*) from public.entries where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A entries');
select is((select count(*) from public.budgets where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A budgets');
select is((select count(*) from public.goals where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A goals');
select is((select count(*) from public.income_sources where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A income_sources');
select is((select count(*) from public.recurring_plans where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A recurring_plans');
select is((select count(*) from public.forecasts where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A forecasts');
select is((select count(*) from public.audit_events where household_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint, 'runtime B1 (json claims) cannot read household A audit_events');

set local role inout_api_runtime;
set local request.jwt.claims = '';
set local request.jwt.claim.sub = '0e0e0e0e-0000-0000-0000-000000000001';
select is((select count(*) from public.accounts), 0::bigint, 'runtime outsider O reads no accounts');
select is((select count(*) from public.categories), 0::bigint, 'runtime outsider O reads no categories');
select is((select count(*) from public.transactions), 0::bigint, 'runtime outsider O reads no transactions');
select is((select count(*) from public.entries), 0::bigint, 'runtime outsider O reads no entries');
select is((select count(*) from public.budgets), 0::bigint, 'runtime outsider O reads no budgets');
select is((select count(*) from public.goals), 0::bigint, 'runtime outsider O reads no goals');
select is((select count(*) from public.income_sources), 0::bigint, 'runtime outsider O reads no income_sources');
select is((select count(*) from public.recurring_plans), 0::bigint, 'runtime outsider O reads no recurring_plans');
select is((select count(*) from public.forecasts), 0::bigint, 'runtime outsider O reads no forecasts');
select is((select count(*) from public.audit_events), 0::bigint, 'runtime outsider O reads no audit_events');
select is((select count(*) from public.household_change_signals), 0::bigint, 'runtime outsider O reads no household_change_signals');
select is((select count(*) from public.households), 0::bigint, 'runtime outsider O reads no households');
select is((select count(*) from public.household_members), 0::bigint, 'runtime outsider O reads no household_members');
select is(pg_temp.sqlstate_of($$insert into public.accounts (household_id, name, kind, created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'x', 'cash', '0e0e0e0e-0000-0000-0000-000000000001')$$), '42501', 'runtime outsider O cannot insert accounts into household A');
select is(pg_temp.affected($$ update public.transactions set description = 'x' $$), 0, 'runtime outsider O cannot update any transaction');

set local role inout_api_runtime;
set local request.jwt.claims = '';
set local request.jwt.claim.sub = '';
select is((select count(*) from public.accounts), 0::bigint, 'runtime missing subject reads no accounts');
select is((select count(*) from public.categories), 0::bigint, 'runtime missing subject reads no categories');
select is((select count(*) from public.transactions), 0::bigint, 'runtime missing subject reads no transactions');
select is((select count(*) from public.entries), 0::bigint, 'runtime missing subject reads no entries');
select is((select count(*) from public.budgets), 0::bigint, 'runtime missing subject reads no budgets');
select is((select count(*) from public.goals), 0::bigint, 'runtime missing subject reads no goals');
select is((select count(*) from public.income_sources), 0::bigint, 'runtime missing subject reads no income_sources');
select is((select count(*) from public.recurring_plans), 0::bigint, 'runtime missing subject reads no recurring_plans');
select is((select count(*) from public.forecasts), 0::bigint, 'runtime missing subject reads no forecasts');
select is((select count(*) from public.audit_events), 0::bigint, 'runtime missing subject reads no audit_events');
select is((select count(*) from public.household_change_signals), 0::bigint, 'runtime missing subject reads no household_change_signals');
select is((select count(*) from public.households), 0::bigint, 'runtime missing subject reads no households');
select is((select count(*) from public.household_members), 0::bigint, 'runtime missing subject reads no household_members');
select is(pg_temp.sqlstate_of($$insert into public.accounts (household_id, name, kind, created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'x', 'cash', 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'runtime missing subject cannot insert accounts into household A');
select is(pg_temp.affected($$ update public.transactions set description = 'x' $$), 0, 'runtime missing subject cannot update any transaction');

reset role;
set local role authenticated;
set local request.jwt.claims = '';
set local request.jwt.claim.sub = 'a1a1a1a1-0000-0000-0000-000000000001';
select is((select count(*) from public.income_sources where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'authenticated A1 cannot read household B income_sources');
select is(pg_temp.affected($$ update public.income_sources set name = 'pwned' where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b' $$), 0, 'authenticated A1 cannot update household B income_sources');
select is(pg_temp.sqlstate_of($$insert into public.income_sources (household_id, name, created_by) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'x', 'a1a1a1a1-0000-0000-0000-000000000001')$$), '42501', 'authenticated A1 cannot insert income_sources into household B');
select is((select count(*) from public.household_change_signals where household_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint, 'authenticated A1 cannot read household B change signals');
select is(pg_temp.sqlstate_of($$ select 1 from public.accounts limit 1 $$), '42501', 'authenticated client has no direct read on accounts');
select is(pg_temp.sqlstate_of($$ select 1 from public.categories limit 1 $$), '42501', 'authenticated client has no direct read on categories');
select is(pg_temp.sqlstate_of($$ select 1 from public.transactions limit 1 $$), '42501', 'authenticated client has no direct read on transactions');
select is(pg_temp.sqlstate_of($$ select 1 from public.entries limit 1 $$), '42501', 'authenticated client has no direct read on entries');
select is(pg_temp.sqlstate_of($$ select 1 from public.budgets limit 1 $$), '42501', 'authenticated client has no direct read on budgets');
select is(pg_temp.sqlstate_of($$ select 1 from public.goals limit 1 $$), '42501', 'authenticated client has no direct read on goals');
select is(pg_temp.sqlstate_of($$ select 1 from public.recurring_plans limit 1 $$), '42501', 'authenticated client has no direct read on recurring_plans');
select is(pg_temp.sqlstate_of($$ select 1 from public.forecasts limit 1 $$), '42501', 'authenticated client has no direct read on forecasts');
select is(pg_temp.sqlstate_of($$ select 1 from public.audit_events limit 1 $$), '42501', 'authenticated client has no direct read on audit_events');

reset role;
set local role anon;
select is(pg_temp.sqlstate_of($$ truncate public.status_types cascade $$), '42501', 'anon cannot truncate status_types');
select is(pg_temp.sqlstate_of($$ truncate public.status_values cascade $$), '42501', 'anon cannot truncate status_values');

reset role;
select * from finish();
rollback;
