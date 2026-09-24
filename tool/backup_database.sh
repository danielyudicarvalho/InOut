#!/usr/bin/env bash
set -euo pipefail
umask 077

# DATABASE_URL and BACKUP_PASSPHRASE are injected by the scheduler, never printed.
if [[ -z "${DATABASE_URL:-}" || -z "${BACKUP_PASSPHRASE:-}" || $# -ne 1 ]]; then
  echo 'Usage: DATABASE_URL=... BACKUP_PASSPHRASE=... backup_database.sh OUTPUT.gpg' >&2
  exit 2
fi

output="$1"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

supabase db dump --db-url "$DATABASE_URL" -f "$workdir/roles.sql" --role-only
supabase db dump --db-url "$DATABASE_URL" -f "$workdir/schema.sql"
supabase db dump --db-url "$DATABASE_URL" -f "$workdir/data.sql" --data-only --use-copy

for file in roles.sql schema.sql data.sql; do
  [[ -s "$workdir/$file" ]] || { echo "Empty backup component: $file" >&2; exit 1; }
done

printf '%s' "$BACKUP_PASSPHRASE" > "$workdir/key"
tar -C "$workdir" -czf "$workdir/backup.tar.gz" roles.sql schema.sql data.sql
gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 \
  --passphrase-file "$workdir/key" --output "$output" "$workdir/backup.tar.gz"
[[ -s "$output" ]] || exit 1
sha256sum "$output"
