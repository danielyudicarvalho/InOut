#!/usr/bin/env bash
set -euo pipefail
umask 077

# Restore into an empty isolated database as a non-superuser owner of public/identity.
# Never against a live Fly cluster. Requires schema create rights, not SUPERUSER.
if [[ $# -ne 1 || -z "${RESTORE_DATABASE_URL:-}" || -z "${BACKUP_PASSPHRASE:-}" || "${CONFIRM_ISOLATED_TARGET:-}" != yes ]]; then
  echo 'Usage: RESTORE_DATABASE_URL=... BACKUP_PASSPHRASE=... CONFIRM_ISOLATED_TARGET=yes restore_database.sh BACKUP.gpg' >&2
  exit 2
fi
if [[ "$RESTORE_DATABASE_URL" == *flympg.net* || "$RESTORE_DATABASE_URL" == *fly.dev* ]]; then
  echo 'Refusing to restore onto a Fly hostname from this script.' >&2
  exit 2
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
printf '%s' "$BACKUP_PASSPHRASE" > "$workdir/key"
gpg --batch --yes --pinentry-mode loopback --quiet --passphrase-file "$workdir/key" \
  --decrypt --output "$workdir/backup.tar.gz" "$1"
tar -xzf "$workdir/backup.tar.gz" -C "$workdir" --no-same-owner

psql --no-psqlrc --single-transaction --set ON_ERROR_STOP=1 \
  --file "$workdir/schema.sql" \
  --file "$workdir/data.sql" \
  --dbname "$RESTORE_DATABASE_URL" > /dev/null
echo 'Restore finished; verify row counts, RLS and ledger reconciliation before cutover.'
