#!/usr/bin/env bash
set -euo pipefail
umask 077

# Restore into an empty isolated database as a non-superuser owner of public/identity.
# Never against a live Fly cluster. Production backup/restore path is pending Daniel.
# shellcheck source=refuse_fly_database_url.sh
source "$(dirname "${BASH_SOURCE[0]}")/refuse_fly_database_url.sh"
if [[ $# -ne 1 || -z "${RESTORE_DATABASE_URL:-}" || -z "${BACKUP_PASSPHRASE:-}" || "${CONFIRM_ISOLATED_TARGET:-}" != yes ]]; then
  echo 'Usage: RESTORE_DATABASE_URL=... BACKUP_PASSPHRASE=... CONFIRM_ISOLATED_TARGET=yes restore_database.sh BACKUP.gpg' >&2
  exit 2
fi
refuse_fly_database_url "$RESTORE_DATABASE_URL" RESTORE_DATABASE_URL || exit 2

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
