#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "migrate" || "${1:-}" == "import" ]]; then
  exec dotnet InOut.Api.dll "$@"
fi

exec dotnet InOut.Api.dll "$@"
