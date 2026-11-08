begin;

-- Fail explicitly rather than silently merging two active categories that only
-- differ by surrounding whitespace after normalization.
do $$
begin
  if exists (
    select 1
    from public.categories
    where archived_at is null
    group by household_id, parent_id, lower(btrim(name))
    having count(*) > 1
  ) then
    raise exception 'active category names conflict after trimming'
      using errcode = '23505';
  end if;
end;
$$;

update public.categories
set name = btrim(name)
where name <> btrim(name);

alter table public.categories
  add constraint categories_name_trimmed_chk
  check (name = btrim(name));

commit;
