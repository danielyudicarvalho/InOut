create index household_invitations_household_id_idx
  on private.household_invitations (household_id);

create index household_invitations_created_by_idx
  on private.household_invitations (created_by);

create index household_invitations_accepted_by_idx
  on private.household_invitations (accepted_by)
  where accepted_by is not null;

create index entries_created_by_idx
  on public.entries (created_by);
