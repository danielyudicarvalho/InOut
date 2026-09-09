#!/usr/bin/env bash

set -euo pipefail

tracked_env_files="$(git ls-files | grep --extended-regexp '(^|/)\.env(\.|$)' \
  | grep --invert-match --extended-regexp '\.env\.example$' || true)"
if [[ -n "$tracked_env_files" ]]; then
  echo "Secret-safety violation: tracked environment file(s):" >&2
  echo "$tracked_env_files" >&2
  exit 1
fi

secret_pattern='sb_secret_|AKIA[0-9A-Z]{16}|-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----'
if git grep --line-number --extended-regexp "$secret_pattern" \
  -- . ':!tool/check_secrets.sh'; then
  echo "Secret-safety violation: probable credential committed." >&2
  exit 1
fi

echo "Secret checks: ok"
