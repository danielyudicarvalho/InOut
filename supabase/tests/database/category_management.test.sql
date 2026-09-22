begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(6);

select ok(
  has_table_privilege('inout_api_runtime', 'public.categories', 'insert')
  and has_column_privilege('inout_api_runtime', 'public.categories', 'archived_at', 'update')
  and not has_table_privilege('inout_api_runtime', 'public.categories', 'delete')
  and not has_table_privilege('authenticated', 'public.categories', 'insert'),
  'only the API creates and archives categories'
);

insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'category-a@inout.test'),
  ('a2000000-0000-0000-0000-000000000002', 'category-b@inout.test');
insert into public.households (id, name, created_by) values
  ('a3000000-0000-0000-0000-000000000003', 'Categories A', 'a1000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-0000-0000-000000000004', 'Categories B', 'a2000000-0000-0000-0000-000000000002');
insert into public.household_members (household_id, user_id, role) values
  ('a3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'owner'),
  ('a4000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002', 'owner');

set local role inout_api_runtime;
set local request.jwt.claim.sub = 'a1000000-0000-0000-0000-000000000001';

insert into public.categories (id, household_id, name, flow, created_by) values
  ('a5000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000003', 'Root', 'expense', 'a1000000-0000-0000-0000-000000000001');
insert into public.categories (id, household_id, parent_id, name, flow, created_by) values
  ('a6000000-0000-0000-0000-000000000006', 'a3000000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-000000000005', 'Child', 'expense', 'a1000000-0000-0000-0000-000000000001');

select throws_ok(
  $$insert into public.categories (household_id, parent_id, name, flow, created_by)
    values ('a3000000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-000000000005', 'Wrong flow', 'income', 'a1000000-0000-0000-0000-000000000001')$$,
  '23514', 'subcategory requires an active root of the same flow',
  'subcategory flow must match its parent'
);
select throws_ok(
  $$insert into public.categories (household_id, parent_id, name, flow, created_by)
    values ('a3000000-0000-0000-0000-000000000003', 'a6000000-0000-0000-0000-000000000006', 'Grandchild', 'expense', 'a1000000-0000-0000-0000-000000000001')$$,
  '23514', 'subcategory requires an active root of the same flow',
  'nested subcategories are rejected'
);
select throws_ok(
  $$update public.categories set archived_at = now()
    where id = 'a5000000-0000-0000-0000-000000000005'$$,
  '23514', 'archive active subcategories first',
  'parent cannot be archived while child is active'
);

update public.categories set archived_at = now()
where id = 'a6000000-0000-0000-0000-000000000006';
select lives_ok(
  $$update public.categories set archived_at = now()
    where id = 'a5000000-0000-0000-0000-000000000005'$$,
  'parent can be archived after child'
);
select throws_ok(
  $$insert into public.categories (household_id, parent_id, name, flow, created_by)
    values ('a3000000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-000000000005', 'Late child', 'expense', 'a1000000-0000-0000-0000-000000000001')$$,
  '23514', 'subcategory requires an active root of the same flow',
  'archived root cannot accept new children'
);

select * from finish();
rollback;
