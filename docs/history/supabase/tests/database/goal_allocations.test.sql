begin;
select plan(22);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password)
values ('d1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','goal-allocation@example.test','');
insert into public.households(id,name,created_by) values
('d2000000-0000-4000-8000-000000000002','Allocation history','d1000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,role) values
('d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','owner');

select lives_ok($$insert into public.goals(id,household_id,name,target_cents,allocated_cents,created_by,currency) values
('d3000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000002','Emergency',10000,0,'d1000000-0000-4000-8000-000000000001','BRL')$$,'a new goal starts without an opening allocation');
select is((select count(*) from public.goal_allocations where goal_id='d3000000-0000-4000-8000-000000000003'),0::bigint,'zero progress has an empty history');

select lives_ok($$insert into public.goal_allocations(id,household_id,goal_id,amount_cents,currency,kind,origin,occurred_on,created_by) values
('d4000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000003',4000,'BRL','contribution','recorded','2026-11-01','d1000000-0000-4000-8000-000000000001')$$,'contribution is accepted');
select is((select allocated_cents from public.goals where id='d3000000-0000-4000-8000-000000000003'),4000::bigint,'progress follows the contribution');
select lives_ok($$insert into public.goal_allocations(id,household_id,goal_id,amount_cents,currency,kind,origin,occurred_on,created_by) values
('d5000000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000003',6000,'BRL','contribution','recorded','2026-11-02','d1000000-0000-4000-8000-000000000001')$$,'second contribution is accepted');
select is((select allocated_cents from public.goals where id='d3000000-0000-4000-8000-000000000003'),10000::bigint,'progress is the sum of contributions');

select lives_ok($$insert into public.goal_allocations(id,household_id,goal_id,amount_cents,currency,kind,origin,reversal_of,occurred_on,created_by) values
('d6000000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000003',4000,'BRL','reversal','recorded','d4000000-0000-4000-8000-000000000004','2026-11-03','d1000000-0000-4000-8000-000000000001')$$,'reversal undoes one contribution');
select is((select allocated_cents from public.goals where id='d3000000-0000-4000-8000-000000000003'),6000::bigint,'progress subtracts the reversed contribution');
select is((select count(*) from public.goal_allocations where goal_id='d3000000-0000-4000-8000-000000000003' and kind='contribution'),2::bigint,'reversed contribution stays in the history');
select throws_ok($$insert into public.goal_allocations(household_id,goal_id,amount_cents,currency,kind,origin,reversal_of,occurred_on,created_by) values
('d2000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000003',4000,'BRL','reversal','recorded','d4000000-0000-4000-8000-000000000004','2026-11-04','d1000000-0000-4000-8000-000000000001')$$,'23505','goal_allocations_one_reversal_per_original_uidx','a contribution can be reversed only once');
select throws_ok($$update public.goal_allocations set amount_cents=1 where id='d5000000-0000-4000-8000-000000000005'$$,'23514','goal_allocation_immutable','allocations cannot be edited');
select throws_ok($$delete from public.goal_allocations where id='d5000000-0000-4000-8000-000000000005'$$,'23514','goal_allocation_immutable','allocations cannot be deleted');
select throws_ok($$update public.goals set allocated_cents=1 where id='d3000000-0000-4000-8000-000000000003'$$,'23514','goal_progress_requires_allocation','progress cannot be rewritten without an allocation');
select throws_ok($$insert into public.goal_allocations(household_id,goal_id,amount_cents,currency,kind,origin,occurred_on,created_by) values
('d2000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000003',10,'USD','contribution','recorded','2026-11-05','d1000000-0000-4000-8000-000000000001')$$,'23514','goal_allocation_currency_mismatch','allocation currency must match the goal');

select lives_ok($$insert into public.goals(id,household_id,name,target_cents,allocated_cents,created_by,currency) values
('d7000000-0000-4000-8000-000000000007','d2000000-0000-4000-8000-000000000002','Legacy',1000,250,'d1000000-0000-4000-8000-000000000001','EUR')$$,'existing progress becomes an opening allocation');
select is((select count(*) from public.goal_allocations where goal_id='d7000000-0000-4000-8000-000000000007' and origin='opening'),1::bigint,'one opening allocation explains the initial balance');
select is((select amount_cents from public.goal_allocations where goal_id='d7000000-0000-4000-8000-000000000007'),250::bigint,'opening amount matches the accumulated balance');
select is((select allocated_cents from public.goals where id='d7000000-0000-4000-8000-000000000007'),250::bigint,'opening allocation preserves the accumulated balance');

alter table public.goals disable trigger goals_enforce_currency;
insert into public.goals(id,household_id,name,target_cents,allocated_cents,created_by,currency) values
('d8000000-0000-4000-8000-000000000008','d2000000-0000-4000-8000-000000000002','Unresolved',500,80,'d1000000-0000-4000-8000-000000000001',null);
alter table public.goals enable trigger goals_enforce_currency;
select lives_ok($$update public.goals set currency='GBP' where id='d8000000-0000-4000-8000-000000000008'$$,'selecting a currency records the previously unexplained balance');
select is((select origin from public.goal_allocations where goal_id='d8000000-0000-4000-8000-000000000008'),'opening','currency selection creates the opening allocation');
select is((select allocated_cents from public.goals where id='d8000000-0000-4000-8000-000000000008'),80::bigint,'currency selection preserves the accumulated balance');
select is((select count(*) from pg_class where oid='public.goal_allocations'::regclass and relrowsecurity),1::bigint,'allocation history retains row level security');
select * from finish();
rollback;
