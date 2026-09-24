#!/usr/bin/env bash
set -euo pipefail

# These switches can place JWTs, request bodies or financial descriptions in logs.
# Review any intentional change to this boundary before enabling it.
if rg --quiet 'EnableSensitiveDataLogging\s*\(|EnableDetailedErrors\s*\(|UseHttpLogging\s*\(|AddHttpLogging\s*\(|LogAllRequestHeaders|LogAllRequestBody' backend/src; then
  echo 'Privacy check failed: sensitive HTTP or database logging was enabled.' >&2
  exit 1
fi

echo 'Logging privacy checks: ok'
