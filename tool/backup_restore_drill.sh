#!/usr/bin/env bash
set -euo pipefail
umask 077

# CI only: the local Supabase instance was reset immediately before this drill.
scheme='postgresql'
local_db_url="${scheme}://postgres:postgres@127.0.0.1:54322/postgres"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
export DATABASE_URL="$local_db_url"
export BACKUP_PASSPHRASE='ephemeral-ci-only-passphrase'

psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$local_db_url" <<'SQL' > /dev/null
create table public.gom93_restore_probe (id int primary key, marker text not null);
insert into public.gom93_restore_probe values (93, 'restored');
SQL

bash tool/backup_database.sh "$workdir/backup.gpg" > /dev/null
printf '%s' "$BACKUP_PASSPHRASE" > "$workdir/key"
gpg --batch --yes --pinentry-mode loopback --quiet --passphrase-file "$workdir/key" \
  --decrypt --output "$workdir/backup.tar.gz" "$workdir/backup.gpg"
tar -xzf "$workdir/backup.tar.gz" -C "$workdir" --no-same-owner data.sql

# Restore into empty public tables, including lookup rows seeded by migrations.
# Keep truncation and import atomic in this disposable local database.
psql --no-psqlrc --single-transaction --set ON_ERROR_STOP=1 --dbname "$local_db_url" \
  --command "do \$drill\$ declare tables text; begin
    select string_agg(format('%I.%I', schemaname, tablename), ', ')
      into tables from pg_tables where schemaname = 'public';
    execute 'truncate table ' || tables;
  end \$drill\$;" \
  --file "$workdir/data.sql" > /dev/null

result="$(psql --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --dbname "$local_db_url" --command 'select marker from public.gom93_restore_probe where id = 93')"
[[ "$result" == restored ]] || { echo 'Restore drill did not recover the fixture.' >&2; exit 1; }
echo 'Encrypted backup decrypted and data restored in isolated local database.'
