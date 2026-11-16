#!/usr/bin/env bash
set -euo pipefail
umask 077

# Disposable local Postgres only (not Fly, not the historic hosted-provider port 54322).
# Do not put user:password in a postgres URI in this file: check_secrets.sh treats that
# form as a committed credential. Libpq reads PGPASSWORD from the environment instead.
if [[ -n "${INOUT_TEST_POSTGRES:-}" ]]; then
  local_db_url="$INOUT_TEST_POSTGRES"
else
  export PGHOST="${PGHOST:-127.0.0.1}"
  export PGPORT="${PGPORT:-5432}"
  export PGUSER="${PGUSER:-postgres}"
  export PGDATABASE="${PGDATABASE:-inout}"
  export PGPASSWORD="${PGPASSWORD:-postgres}"
  local_db_url="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
fi
if [[ "$local_db_url" == *flympg.net* || "$local_db_url" == *54322* ]]; then
  echo 'Drill refuses Fly hosts and the historic hosted-provider port 54322.' >&2
  exit 2
fi
export INOUT_ALLOW_LOCAL_BACKUP=yes
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
export DATABASE_URL="$local_db_url"
export BACKUP_PASSPHRASE='ephemeral-ci-only-passphrase'
export RESTORE_DATABASE_URL="$local_db_url"
export CONFIRM_ISOLATED_TARGET=yes

psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$local_db_url" <<'SQL' > /dev/null
create table if not exists public.inout_restore_probe (id int primary key, marker text not null);
insert into public.inout_restore_probe values (1, 'restored')
on conflict (id) do update set marker = excluded.marker;
SQL

bash tool/backup_database.sh "$workdir/backup.gpg" > /dev/null
psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$local_db_url" \
  --command "drop table public.inout_restore_probe"
bash tool/restore_database.sh "$workdir/backup.gpg" > /dev/null

result="$(psql --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --dbname "$local_db_url" --command 'select marker from public.inout_restore_probe where id = 1')"
[[ "$result" == restored ]] || { echo 'Restore drill did not recover the fixture.' >&2; exit 1; }
echo 'Encrypted backup decrypted and data restored in isolated local database.'
