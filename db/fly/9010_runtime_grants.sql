-- Reassert the runtime role and grant only the identity schema the API must use
-- to authenticate. Financial tables keep the grants and RLS policies from the
-- domain migrations. Identity tables are not RLS-protected: password lookup
-- happens before a subject exists, and end users never receive this role.

alter role inout_api_runtime
  noinherit
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls;

grant usage on schema identity to inout_api_runtime;
grant select, insert, update, delete on all tables in schema identity to inout_api_runtime;
grant usage, select on all sequences in schema identity to inout_api_runtime;
alter default privileges in schema identity
  grant select, insert, update, delete on tables to inout_api_runtime;
alter default privileges in schema identity
  grant usage, select on sequences to inout_api_runtime;

revoke all on schema identity from public;
revoke all on schema private from public;
revoke all on schema extensions from public;

grant usage on schema extensions to inout_api_runtime;
grant execute on all functions in schema extensions to inout_api_runtime;
