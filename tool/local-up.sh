#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo 'Docker is required' >&2; exit 1; }
command -v supabase >/dev/null || { echo 'Supabase CLI is required' >&2; exit 1; }

supabase start
status="$(supabase status -o env)"
read_status() {
  printf '%s\n' "$status" | sed -n "s/^$1=//p" | head -n 1 | tr -d '"\r'
}
key="$(read_status ANON_KEY)"
secret="$(read_status JWT_SECRET)"
if [[ -z "$key" || -z "$secret" ]]; then
  echo 'Supabase CLI did not report ANON_KEY and JWT_SECRET' >&2
  exit 1
fi

# Local development credential; never use it with a deployed database.
password='inout_local_dev_only_password'
docker run --rm --network host -e PGPASSWORD=postgres postgres:17-alpine \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "ALTER ROLE inout_api_runtime LOGIN PASSWORD '$password'"

# A private Compose env file keeps credentials out of command arguments and Git.
umask 077
{
  printf 'INOUT_DB_PASSWORD=%s\n' "$password"
  printf 'SUPABASE_JWT_SECRET=%s\n' "$secret"
  printf 'SUPABASE_ANON_KEY=%s\n' "$key"
} > .env.docker.local

docker compose --env-file .env.docker.local up --build -d
echo 'Flutter: http://localhost:8081  API: http://localhost:8080/health/live'
echo 'Supabase API: http://localhost:54321  Database: localhost:54322'
