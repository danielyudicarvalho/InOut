begin;
select plan(14);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password)
values ('e1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recurring-occurrence@example.test','');
insert into public.households(id,name,created_by) values
('e2000000-0000-4000-8000-000000000002','Recurring occurrences','e1000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,role) values
('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','owner');
insert into public.accounts(id,household_id,name,kind,currency,created_by) values
('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000002','Checking','checking','BRL','e1000000-0000-4000-8000-000000000001');
insert into public.categories(id,household_id,name,flow,created_by) values
('e4000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000002','Rent','expense','e1000000-0000-4000-8000-000000000001');

select lives_ok($$insert into public.recurring_plans(
  id,household_id,name,flow,account_id,category_id,amount_cents,currency,day_of_month,starts_on,created_by)
values (
  'e5000000-0000-4000-8000-000000000005','e2000000-0000-4000-8000-000000000002','Rent','expense',
  'e3000000-0000-4000-8000-000000000003','e4000000-0000-4000-8000-000000000004',180000,'BRL',31,'2026-01-01',
  'e1000000-0000-4000-8000-000000000001')$$,'an active plan can be stored without occurrences');
select is((select count(*) from public.recurring_occurrences),'0'::bigint,'calculating nothing inserts no occurrence');

insert into public.transactions(id,household_id,kind,status,description,occurred_on,created_by,posted_at) values
('e6000000-0000-4000-8000-000000000006','e2000000-0000-4000-8000-000000000002','expense','posted','Rent','2026-02-28','e1000000-0000-4000-8000-000000000001',now());
insert into public.entries(id,household_id,transaction_id,account_id,category_id,direction,amount_cents,created_by) values
('e7000000-0000-4000-8000-000000000007','e2000000-0000-4000-8000-000000000002','e6000000-0000-4000-8000-000000000006','e3000000-0000-4000-8000-000000000003','e4000000-0000-4000-8000-000000000004','debit',180000,'e1000000-0000-4000-8000-000000000001');

select lives_ok($$insert into public.recurring_occurrences(
  id,household_id,plan_id,scheduled_on,transaction_id,flow,amount_cents,currency,created_by)
values (
  'e8000000-0000-4000-8000-000000000008','e2000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000005',
  '2026-02-28','e6000000-0000-4000-8000-000000000006','expense',180000,'BRL','e1000000-0000-4000-8000-000000000001')$$,
  'the clamped February date is realized by its expense');
select is((select transaction_id from public.recurring_occurrences where scheduled_on='2026-02-28'),
  'e6000000-0000-4000-8000-000000000006'::uuid,'the occurrence points at the realizing transaction');

insert into public.transactions(id,household_id,kind,status,description,occurred_on,created_by,posted_at) values
('e8100000-0000-4000-8000-000000000081','e2000000-0000-4000-8000-000000000002','expense','posted','Rent','2026-02-28','e1000000-0000-4000-8000-000000000001',now());
insert into public.entries(id,household_id,transaction_id,account_id,category_id,direction,amount_cents,created_by) values
('e8200000-0000-4000-8000-000000000082','e2000000-0000-4000-8000-000000000002','e8100000-0000-4000-8000-000000000081','e3000000-0000-4000-8000-000000000003','e4000000-0000-4000-8000-000000000004','debit',180000,'e1000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.recurring_occurrences(
  household_id,plan_id,scheduled_on,transaction_id,flow,amount_cents,currency,created_by)
values (
  'e2000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000005','2026-02-28',
  'e8100000-0000-4000-8000-000000000081','expense',180000,'BRL','e1000000-0000-4000-8000-000000000001')$$,
  '23505','recurring_occurrences_plan_date_uidx','the same predicted date cannot be realized twice');

insert into public.transactions(id,household_id,kind,status,description,occurred_on,created_by,posted_at) values
('e9000000-0000-4000-8000-000000000009','e2000000-0000-4000-8000-000000000002','expense','posted','Rent','2026-02-27','e1000000-0000-4000-8000-000000000001',now());
insert into public.entries(id,household_id,transaction_id,account_id,category_id,direction,amount_cents,created_by) values
('ea000000-0000-4000-8000-00000000000a','e2000000-0000-4000-8000-000000000002','e9000000-0000-4000-8000-000000000009','e3000000-0000-4000-8000-000000000003','e4000000-0000-4000-8000-000000000004','debit',180000,'e1000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.recurring_occurrences(
  household_id,plan_id,scheduled_on,transaction_id,flow,amount_cents,currency,created_by)
values (
  'e2000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000005','2026-02-27',
  'e9000000-0000-4000-8000-000000000009','expense',180000,'BRL','e1000000-0000-4000-8000-000000000001')$$,
  '23514','recurring_occurrence_not_scheduled','a date the plan does not produce cannot be realized');

insert into public.transactions(id,household_id,kind,status,description,occurred_on,created_by,posted_at) values
('eb000000-0000-4000-8000-00000000000b','e2000000-0000-4000-8000-000000000002','expense','posted','Rent','2026-03-31','e1000000-0000-4000-8000-000000000001',now());
insert into public.entries(id,household_id,transaction_id,account_id,category_id,direction,amount_cents,created_by) values
('ec000000-0000-4000-8000-00000000000c','e2000000-0000-4000-8000-000000000002','eb000000-0000-4000-8000-00000000000b','e3000000-0000-4000-8000-000000000003','e4000000-0000-4000-8000-000000000004','debit',1,'e1000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.recurring_occurrences(
  household_id,plan_id,scheduled_on,transaction_id,flow,amount_cents,currency,created_by)
values (
  'e2000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000005','2026-03-31',
  'eb000000-0000-4000-8000-00000000000b','expense',180000,'BRL','e1000000-0000-4000-8000-000000000001')$$,
  '23514','recurring_occurrence_transaction_mismatch','the transaction must match the plan amount');

update public.entries set amount_cents = 180000 where id = 'ec000000-0000-4000-8000-00000000000c';
select throws_ok($$update public.recurring_occurrences set amount_cents = 1 where id = 'e8000000-0000-4000-8000-000000000008'$$,
  '23514','recurring_occurrence_immutable','an occurrence cannot be edited');
select throws_ok($$delete from public.recurring_occurrences where id = 'e8000000-0000-4000-8000-000000000008'$$,
  '23514','recurring_occurrence_immutable','an occurrence cannot be deleted');

select lives_ok($$insert into public.recurring_occurrences(
  id,household_id,plan_id,scheduled_on,transaction_id,flow,amount_cents,currency,created_by)
values (
  'ed000000-0000-4000-8000-00000000000d','e2000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000005',
  '2026-03-31','eb000000-0000-4000-8000-00000000000b','expense',180000,'BRL','e1000000-0000-4000-8000-000000000001')$$,
  'a later predicted date can be realized by its own transaction');

insert into public.recurring_plans(
  id,household_id,name,flow,account_id,category_id,amount_cents,currency,day_of_month,starts_on,created_by)
values (
  'ee000000-0000-4000-8000-00000000000e','e2000000-0000-4000-8000-000000000002','Rent copy','expense',
  'e3000000-0000-4000-8000-000000000003','e4000000-0000-4000-8000-000000000004',180000,'BRL',31,'2026-01-01',
  'e1000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.recurring_occurrences(
  household_id,plan_id,scheduled_on,transaction_id,flow,amount_cents,currency,created_by)
values (
  'e2000000-0000-4000-8000-000000000002','ee000000-0000-4000-8000-00000000000e','2026-02-28',
  'e6000000-0000-4000-8000-000000000006','expense',180000,'BRL','e1000000-0000-4000-8000-000000000001')$$,
  '23505','recurring_occurrences_transaction_uidx','one transaction realizes only one occurrence');

update public.recurring_plans set status_id = 14 where id = 'e5000000-0000-4000-8000-000000000005';
insert into public.transactions(id,household_id,kind,status,description,occurred_on,created_by,posted_at) values
('ef000000-0000-4000-8000-00000000000f','e2000000-0000-4000-8000-000000000002','expense','posted','Rent','2026-04-30','e1000000-0000-4000-8000-000000000001',now());
insert into public.entries(id,household_id,transaction_id,account_id,category_id,direction,amount_cents,created_by) values
('e1100000-0000-4000-8000-000000000011','e2000000-0000-4000-8000-000000000002','ef000000-0000-4000-8000-00000000000f','e3000000-0000-4000-8000-000000000003','e4000000-0000-4000-8000-000000000004','debit',180000,'e1000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.recurring_occurrences(
  household_id,plan_id,scheduled_on,transaction_id,flow,amount_cents,currency,created_by)
values (
  'e2000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000005','2026-04-30',
  'ef000000-0000-4000-8000-00000000000f','expense',180000,'BRL','e1000000-0000-4000-8000-000000000001')$$,
  '23514','recurring_occurrence_plan_not_executable','a paused plan cannot be realized');

select is((select count(*) from pg_class where oid = 'public.recurring_occurrences'::regclass and relrowsecurity),
  1::bigint,'occurrence links retain row level security');
select is((select count(*) from public.recurring_occurrences where plan_id = 'e5000000-0000-4000-8000-000000000005'),
  2::bigint,'realized dates stay recorded');
select * from finish();
rollback;
