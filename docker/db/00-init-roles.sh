#!/bin/bash
set -e

RUNTIME_PASS="${INOUT_DB_PASSWORD:-inout_runtime_pass}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inout_api_runtime') THEN
        CREATE ROLE inout_api_runtime WITH LOGIN PASSWORD '$RUNTIME_PASS' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      ELSE
        ALTER ROLE inout_api_runtime WITH LOGIN PASSWORD '$RUNTIME_PASS';
      END IF;
    END
    \$\$;
EOSQL
