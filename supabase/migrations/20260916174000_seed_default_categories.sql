-- Existing households predate the API-level default category creation.
insert into public.categories (id, household_id, name, flow, created_by)
select gen_random_uuid(),
       household.id,
       seed.name,
       seed.flow,
       household.created_by
from public.households as household
cross join (values
  ('Salário', 'income'),
  ('Outras receitas', 'income'),
  ('Moradia', 'expense'),
  ('Alimentação', 'expense'),
  ('Transporte', 'expense'),
  ('Outras despesas', 'expense')
) as seed(name, flow)
where not exists (
  select 1
  from public.categories as category
  where category.household_id = household.id
    and category.parent_id is null
    and category.archived_at is null
    and lower(category.name) = lower(seed.name)
);
