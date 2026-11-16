#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

check() {
  local file="$1"
  local pattern="$2"
  local message="$3"
  if ! grep -E -q "$pattern" "$file"; then
    echo "missing: $message ($file)"
    fail=1
  fi
}

check "$root/backend/Dockerfile" 'COPY .*db ./db' 'API image copies db/fly for the migrator'
check "$root/backend/Dockerfile" 'docker-entrypoint.sh' 'API image uses an entrypoint that can forward migrate args'
check "$root/backend/docker-entrypoint.sh" 'migrate' 'entrypoint forwards migrate'
check "$root/backend/docker-entrypoint.sh" 'import' 'entrypoint forwards import'
check "$root/fly.toml" 'release_command' 'fly.toml defines a migration release command'
check "$root/fly.toml" "dockerfile = 'backend/Dockerfile'" 'fly.toml builds the API image'
check "$root/fly.web.toml" "dockerfile = 'frontend/Dockerfile'" 'fly.web.toml builds the BFF image'
check "$root/fly.web.toml" 'API_BASE_URL' 'BFF points at the API'
check "$root/compose.yaml" 'migrator:' 'compose defines the migration step'
check "$root/compose.yaml" 'web:' 'compose defines the BFF'

if [[ ! -d "$root/db/fly/migrations" ]]; then
  echo "missing: db/fly/migrations"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "ok"
