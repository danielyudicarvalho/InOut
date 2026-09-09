#!/usr/bin/env bash

set -euo pipefail

forbidden='package:(flutter|flutter_riverpod|go_router|supabase)|dart:(html|io)'

if rg --line-number "$forbidden" lib/src/domain lib/src/application; then
  echo "Architecture violation: domain/application imports framework or infrastructure APIs." >&2
  exit 1
fi

if rg --line-number 'src/(infrastructure|presentation)/' lib/src/domain lib/src/application; then
  echo "Architecture violation: an inner layer imports an outer layer." >&2
  exit 1
fi

if rg --line-number 'Color\(0x' lib/src/presentation \
  --glob '!**/theme/inout_theme.dart'; then
  echo "Design-system violation: literal colors must live in semantic theme tokens." >&2
  exit 1
fi

echo "Architecture boundaries: ok"
