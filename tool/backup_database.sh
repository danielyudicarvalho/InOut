#!/usr/bin/env bash
set -euo pipefail
umask 077

# Direct endpoint only. Do not dump Fly Managed Postgres from a GitHub runner.
# Operators should prefer Fly MPG automated backups. This script is for an
# isolated drill or a fly-proxied one-off, never a public database URL.
if [[ -z "${DATABASE_URL:-}" || -z "${BACKUP_PASSPHRASE:-}" || $# -ne 1 ]]; then
  echo 'Usage: DATABASE_URL=... BACKUP_PASSPHRASE=... backup_database.sh OUTPUT.gpg' >&2
  exit 2
fi
if [[ "$DATABASE_URL" == *flympg.net* || "$DATABASE_URL" == *fly.dev* ]]; then
  echo 'Refusing to dump a Fly hostname from this script. Use Fly MPG backups or a fly proxy job.' >&2
  exit 2
fi

output="$1"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# Schema and data only. Role dumps need superuser and are out of scope for the runtime role.
pg_dump --dbname="$DATABASE_URL" --schema-only --no-owner --no-privileges > "$workdir/schema.sql"
pg_dump --dbname="$DATABASE_URL" --data-only --no-owner --no-privileges > "$workdir/data.sql"

for file in schema.sql data.sql; do
  [[ -s "$workdir/$file" ]] || { echo "Empty backup component: $file" >&2; exit 1; }
done

printf '%s' "$BACKUP_PASSPHRASE" > "$workdir/key"
tar -C "$workdir" -czf "$workdir/backup.tar.gz" schema.sql data.sql
gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 \
  --passphrase-file "$workdir/key" --output "$output" "$workdir/backup.tar.gz"
[[ -s "$output" ]] || exit 1
sha256sum "$output"
