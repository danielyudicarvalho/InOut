begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(7);
grant inout_api_runtime to postgres;
grant usage on schema extensions to inout_api_runtime;
insert into auth.users(id,email) values
('b1000000-0000-4000-8000-000000000001','collab-owner@inout.test'),
('b2000000-0000-4000-8000-000000000002','collab-member@inout.test');
insert into public.households(id,name,created_by) values
('b3000000-0000-4000-8000-000000000003','Collaboration','b1000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,role) values
('b3000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001','owner'),
('b3000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000002','member');
insert into public.accounts(id,household_id,name,kind,currency,created_by) values
('b4000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000003','Historical account','checking','BRL','b1000000-0000-4000-8000-000000000001');
set local role inout_api_runtime;
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000001';
select throws_ok($$delete from public.household_members where household_id='b3000000-0000-4000-8000-000000000003' and user_id='b1000000-0000-4000-8000-000000000001'$$,'23514','last_household_owner','last responsible cannot leave');
set local request.jwt.claim.sub='b2000000-0000-4000-8000-000000000002';
update public.household_members set role='owner' where household_id='b3000000-0000-4000-8000-000000000003' and user_id='b2000000-0000-4000-8000-000000000002';
select is((select role from public.household_members where household_id='b3000000-0000-4000-8000-000000000003' and user_id='b2000000-0000-4000-8000-000000000002'),'member','member cannot self-promote');
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000001';
select lives_ok($$update public.household_members set role='owner' where household_id='b3000000-0000-4000-8000-000000000003' and user_id='b2000000-0000-4000-8000-000000000002'$$,'owner can appoint a successor');
select lives_ok($$delete from public.household_members where household_id='b3000000-0000-4000-8000-000000000003' and user_id='b1000000-0000-4000-8000-000000000001'$$,'responsible can leave after succession');
select is((select count(*) from public.accounts where id='b4000000-0000-4000-8000-000000000004'),0::bigint,'departed member loses financial reads');
reset role;
select is((select created_by from public.accounts where id='b4000000-0000-4000-8000-000000000004'),'b1000000-0000-4000-8000-000000000001'::uuid,'historical authorship is retained');
set local role inout_api_runtime;
set local request.jwt.claim.sub='b2000000-0000-4000-8000-000000000002';
select throws_ok($$update public.household_members set role='member' where household_id='b3000000-0000-4000-8000-000000000003' and user_id='b2000000-0000-4000-8000-000000000002'$$,'23514','last_household_owner','successor is protected as last responsible');
select * from finish();
rollback;
