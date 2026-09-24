#!/usr/bin/env bash
set -euo pipefail
umask 077

# Run against a fresh, isolated Supabase project only; never against the source database.
if [[ $# -ne 1 || -z "${RESTORE_DATABASE_URL:-}" || -z "${BACKUP_PASSPHRASE:-}" || "${CONFIRM_ISOLATED_TARGET:-}" != yes ]]; then
  echo 'Usage: RESTORE_DATABASE_URL=... BACKUP_PASSPHRASE=... CONFIRM_ISOLATED_TARGET=yes restore_database.sh BACKUP.gpg' >&2
  exit 2
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
printf '%s' "$BACKUP_PASSPHRASE" > "$workdir/key"
gpg --batch --yes --pinentry-mode loopback --quiet --passphrase-file "$workdir/key" \
  --decrypt --output "$workdir/backup.tar.gz" "$1"
tar -xzf "$workdir/backup.tar.gz" -C "$workdir" --no-same-owner roles.sql schema.sql data.sql

psql --no-psqlrc --single-transaction --set ON_ERROR_STOP=1 \
  --file "$workdir/roles.sql" --file "$workdir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$workdir/data.sql" --dbname "$RESTORE_DATABASE_URL" > /dev/null
echo 'Restore finished; verify row counts, RLS and ledger reconciliation before cutover.'
