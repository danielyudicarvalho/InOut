-- Category writes remain behind the API; the database independently guards hierarchy.
grant insert, update (archived_at) on public.categories to inout_api_runtime;

create policy categories_insert_api_member on public.categories
for insert to inout_api_runtime
with check (
  (select private.is_household_member(household_id))
  and created_by = (select auth.uid())
);

create policy categories_update_api_member on public.categories
for update to inout_api_runtime
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));

create function private.enforce_category_hierarchy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_row record;
begin
  if new.parent_id is not null then
    select parent_id, archived_at, flow into parent_row
    from public.categories
    where household_id = new.household_id and id = new.parent_id
    for update;
    if not found then
      raise exception 'subcategory requires a root category in this household'
        using errcode = '23514';
    end if;
    if parent_row.parent_id is not null
       or parent_row.flow <> new.flow
       or (new.archived_at is null and parent_row.archived_at is not null) then
      raise exception 'subcategory requires an active root of the same flow'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.archived_at is null and new.archived_at is not null
     and exists (
       select 1 from public.categories
       where household_id = new.household_id
         and parent_id = new.id and archived_at is null
     ) then
    raise exception 'archive active subcategories first'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_category_hierarchy()
  from public, anon, authenticated;

create trigger categories_enforce_hierarchy
before insert or update of archived_at, parent_id, flow on public.categories
for each row execute function private.enforce_category_hierarchy();
