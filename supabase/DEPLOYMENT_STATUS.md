# InOut database migration status — 2026-09-25

The active InOut project (`utwxmnzfcmgxqejrvklg`) received the existing SQL
from these repository migrations through the Supabase migration API:

| Live version | Existing source migration |
| --- | --- |
| `20260924210317` | `20260915191256_add_opening_balance_transaction_kind.sql` |
| `20260924210337` | `20260917030000_add_generic_idempotency_outbox_inbox.sql` |
| `20260924210356` | `20260921213000_category_management.sql` |

Version `20260924210516` grants the API runtime only the ledger access needed
by idempotent account, category and posting commands. The broader
`20260915033027_cut_over_legacy_client_paths.sql` migration was **not** applied:
it also revokes client access across the application. Its migration version and
the other pending repository versions must be reconciled with the live history
before using an automated `db push` against this project. Do not rerun the
three migrations above against a schema that already contains their objects.

Version `20260924213947` adds `public.recurring_plans` for monthly expectations;
the matching migration file is in this repository. It has scoped household
references, RLS, and API-only privileges. This table holds plans and never
posts transactions or changes balances by itself.

Version `20260925112439` adds `public.forecasts` for dated account-level
projection snapshots. Each snapshot records its starting ledger balance,
monthly projected amounts, contributing recurring plan identifiers, calculation
time, and calculation horizon. Household membership policies and API-only
privileges protect the data. Snapshots do not change balances or post entries.

The generic operation identity is stored in `private.idempotency_requests` and
keyed by `(tenant_id, operation, idempotency_key)`. The API verifies actor and
request fingerprint on replay, stores completed responses and processing state,
and uses the same database transaction for the business effect and result.
`CreateAccount` and `CreateCategory` use this coordinator in the existing code.

Structural checks of the active database confirmed RLS, scoped runtime access,
the fingerprint, response and status columns, and no direct client read access.
The live identity table contained no rows at verification, so replay and
concurrency behavior still require integration tests with authenticated users.
