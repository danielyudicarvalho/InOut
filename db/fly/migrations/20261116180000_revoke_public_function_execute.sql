-- Forward-only: 9010 already applied on main must not be edited. Revoke default
-- PUBLIC execute on extension functions while keeping the runtime grants.
revoke execute on all functions in schema extensions from public;
revoke execute on all functions in schema public from public;
alter default privileges in schema extensions revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

grant execute on function extensions.gen_random_bytes(integer) to inout_api_runtime;
grant execute on function extensions.digest(text, text) to inout_api_runtime;
grant execute on function extensions.digest(bytea, text) to inout_api_runtime;
