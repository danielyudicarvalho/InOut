#!/usr/bin/env bash
set -euo pipefail
umask 077

# CI only: the local Supabase instance was reset immediately before this drill.
local_db_url='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
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

psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$local_db_url" \
  --command 'delete from public.gom93_restore_probe where id = 93' > /dev/null
psql --no-psqlrc --single-transaction --set ON_ERROR_STOP=1 --dbname "$local_db_url" \
  --file "$workdir/data.sql" > /dev/null

result="$(psql --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --dbname "$local_db_url" --command 'select marker from public.gom93_restore_probe where id = 93')"
[[ "$result" == restored ]] || { echo 'Restore drill did not recover the fixture.' >&2; exit 1; }
echo 'Encrypted backup decrypted and data restored in isolated local database.'
