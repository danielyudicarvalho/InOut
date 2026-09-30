#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mode="${1:-cloud}"
case "$mode" in
  cloud) compose_file=compose.cloud.yaml; env_file=.env.cloud ;;
  local) compose_file=compose.yaml; env_file=.env.docker.local ;;
  *) echo 'Usage: bash tool/export-docker-logs.sh [cloud|local]' >&2; exit 2 ;;
esac

mkdir -p logs/api logs/web
docker compose -f "$compose_file" --env-file "$env_file" cp api:/var/log/inout/. logs/api/
docker compose -f "$compose_file" --env-file "$env_file" cp web:/var/log/inout/. logs/web/
echo 'Container logs copied to logs/api and logs/web'
