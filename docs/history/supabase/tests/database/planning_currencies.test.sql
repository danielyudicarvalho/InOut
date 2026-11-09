begin;
select plan(12);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password)
values ('c1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','planning-currency@example.test','');
insert into public.households(id,name,created_by) values
('c2000000-0000-4000-8000-000000000002','Currency regression','c1000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,role) values
('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','owner');
insert into public.categories(id,household_id,name,flow,created_by) values
('c3000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000002','Food','expense','c1000000-0000-4000-8000-000000000001');
select lives_ok($$insert into public.budgets(household_id,category_id,period_start,period_end,limit_cents,created_by,currency) values
('c2000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000003','2026-10-01','2026-10-31',10000,'c1000000-0000-4000-8000-000000000001','BRL')$$,'BRL budget is accepted');
select lives_ok($$insert into public.budgets(household_id,category_id,period_start,period_end,limit_cents,created_by,currency) values
('c2000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000003','2026-10-01','2026-10-31',500,'c1000000-0000-4000-8000-000000000001','USD')$$,'USD budget coexists for the same category and dates');
select throws_ok($$insert into public.budgets(household_id,category_id,period_start,period_end,limit_cents,created_by,currency) values
('c2000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000003','2026-10-01','2026-10-31',600,'c1000000-0000-4000-8000-000000000001','USD')$$,'23505',null,'same-currency duplicate is rejected');
select throws_ok($$insert into public.budgets(household_id,category_id,period_start,period_end,limit_cents,created_by) values
('c2000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000003','2026-11-01','2026-11-30',100,'c1000000-0000-4000-8000-000000000001')$$,'23514','planning_currency_required','new budgets need currency');
select throws_ok($$update public.budgets set currency='usd' where household_id='c2000000-0000-4000-8000-000000000002' and currency='USD'$$,'23514','planning_currency_required','database requires canonical currency');
select throws_ok($$update public.budgets set currency='EUR' where household_id='c2000000-0000-4000-8000-000000000002' and currency='USD'$$,'23514','planning_currency_immutable','assigned budget currency cannot change');
select throws_ok($$insert into public.goals(household_id,name,target_cents,created_by) values
('c2000000-0000-4000-8000-000000000002','No currency',1000,'c1000000-0000-4000-8000-000000000001')$$,'23514','planning_currency_required','new goals need currency');
select lives_ok($$insert into public.goals(id,household_id,name,target_cents,allocated_cents,created_by,currency) values
('c4000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000002','Travel',1000,100,'c1000000-0000-4000-8000-000000000001','USD')$$,'goal with explicit currency is accepted');
select is((select currency from public.goals where id='c4000000-0000-4000-8000-000000000004'),'USD','goal currency is persisted');
select throws_ok($$update public.goals set currency='BRL' where id='c4000000-0000-4000-8000-000000000004'$$,'23514','planning_currency_immutable','assigned goal currency cannot change');
select is((select allocated_cents from public.goals where id='c4000000-0000-4000-8000-000000000004'),100::bigint,'rejected currency change preserves allocated amount');
select is((select count(*) from pg_class where oid in ('public.budgets'::regclass,'public.goals'::regclass) and relrowsecurity),2::bigint,'planning tables retain RLS');
select * from finish();
rollback;
