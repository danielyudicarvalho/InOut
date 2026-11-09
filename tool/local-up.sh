#!/usr/bin/env bash
set -euo pipefail

# Development database bootstrap. This does not provision Fly or export live data.
if [[ -z "${INOUT_DIRECT_URL:-}" ]]; then
  echo 'Set INOUT_DIRECT_URL to a disposable Postgres direct endpoint, then run:' >&2
  echo '  cd backend && ConnectionStrings__InOutDirect="$INOUT_DIRECT_URL" dotnet run --project src/InOut.Api -- migrate' >&2
  exit 2
fi

cd "$(dirname "$0")/../backend"
ConnectionStrings__InOutDirect="$INOUT_DIRECT_URL" dotnet run --project src/InOut.Api -- migrate
echo 'Schema applied. Create the inout_api_runtime login out of band before starting the API.'
