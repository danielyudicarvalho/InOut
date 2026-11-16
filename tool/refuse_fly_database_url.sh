#!/usr/bin/env bash
# Shared Fly-target refusal for backup/restore scripts. Production backups are
# pending Daniel's decision (Fly MPG built-in vs an in-Fly job). These scripts
# must not be pointed at Fly, including 6PN, Flycast, or `fly proxy` localhost.
set -euo pipefail

refuse_fly_database_url() {
  local url="${1:-}"
  local name="${2:-DATABASE_URL}"
  local lower
  lower="$(printf '%s' "$url" | tr '[:upper:]' '[:lower:]')"
  if [[ "$lower" == *flympg.net* ||
        "$lower" == *fly.dev* ||
        "$lower" == *fly.io* ||
        "$lower" == *.internal* ||
        "$lower" == *.flycast* ||
        "$lower" == *flycast* ]]; then
    echo "Refusing to use a Fly hostname in ${name}. Production backup path is pending Daniel's decision." >&2
    return 2
  fi
  if [[ "${INOUT_ALLOW_LOCAL_BACKUP:-}" != "yes" ]] &&
     [[ "$lower" == *127.0.0.1* ||
        "$lower" == *localhost* ||
        "$lower" == *\[::1\]* ||
        "$lower" == *0.0.0.0* ]]; then
    echo "Refusing localhost in ${name} (includes fly proxy). Set INOUT_ALLOW_LOCAL_BACKUP=yes only for an isolated local drill." >&2
    return 2
  fi
  return 0
}
