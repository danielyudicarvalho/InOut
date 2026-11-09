#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Historic migration records may name the previous provider. Runtime code may not.
matches="$(rg -n -i 'supabase' \
  --glob '!docs/history/**' \
  --glob '!docs/adr/**' \
  --glob '!docs/fly-identity-migration.md' \
  --glob '!backend/tests/InOut.ArchitectureTests/DependencyDirectionTests.cs' \
  --glob '!frontend/tests/auth-provider.test.mjs' \
  --glob '!tool/check_no_hosted_auth_runtime.sh' \
  --glob '!**/.git/**' \
  || true)"
if [[ -n "$matches" ]]; then
  echo 'Hosted-auth runtime references remain outside historic docs:' >&2
  echo "$matches" >&2
  exit 1
fi
echo 'No hosted-auth runtime references outside historic docs.'
