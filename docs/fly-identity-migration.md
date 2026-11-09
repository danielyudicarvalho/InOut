# Fly Managed Postgres and ASP.NET Identity

Review-only. This change does not provision Fly, export live data, deploy, or cut over.

## Baseline

- Branch `UI` at `9964f25f8acafe0a310a396d9b64ed64eb0e3e7c`.
- Verified stack: ASP.NET Core 10 modular monolith, Next.js 16.4.2, Expo SDK 58. The README matches that shape.
- Historic `docs/history/10-previous-provider-boundary-inventory.md` describes an older Flutter/empty-database snapshot. It is not the live UI baseline.

## What the UI branch actually used

| Capability | Live on UI | Replacement |
| --- | --- | --- |
| Email/password sign-in, sign-up, confirm, resend, recovery | Yes, client SDK | ASP.NET Core Identity `<Guid>` inside the existing API |
| Bearer access token to the API | Yes | OpenIddict reference access and refresh tokens |
| Web cookie/SSR session | No | Next BFF, HttpOnly AES-GCM cookie, CSRF, tokens stay on the server |
| Mobile token storage | AsyncStorage | System browser, authorization code, S256 PKCE, SecureStore, no native secret |
| OAuth providers | Not used by the clients | Not implemented; provider issuer+subject can be imported |
| MFA | Not used by the clients | Re-enrollment blocks password-only login when a factor is imported |
| Storage buckets | Disabled | No replacement; none was in use |
| Edge functions | None | None |
| Realtime client subscriptions | Publication existed; no client subscriber | Not replaced; no client caller |
| SQL functions, triggers, RLS | Yes | Ported to `db/fly` and still enforced with `private.auth_uid()` |
| Email | Confirm and recovery | SMTP required in production; capture delivery refused there |

## Runtime shape

- Identity owns membership, login and recovery. OpenIddict is only the protocol machinery.
- Web confidential client `inout-web`. Mobile public client `inout-mobile`.
- Access tokens last 10 minutes. Refresh tokens last 14 days, roll, and are revoked by security stamp on reset or explicit revocation.
- Data Protection keys are stored in `identity.data_protection_keys`. Production signing and encryption certificates come from PEM environment variables. Development certificates are refused in production.
- Session pooling is required. Transaction pooling throws at startup. Direct URL is required for migrations. Client lifetimes are 600 seconds and idle lifetime 300 seconds (`ConnectionLifetime` and `ConnectionIdleLifetime`).
- `gru` in `fly.toml` is an unapproved candidate. Production refuses to start until `Deployment:RegionApproved` is true and machine count plus cluster client limit are set. No latency sample was measured.

## Database

- `inout_api_runtime` is `NOLOGIN` until an operator sets a password, `NOBYPASSRLS`, and is not the owner.
- Financial RLS still reads the transaction-local `request.jwt.claim.sub` set by the API on the same connection and transaction.
- Identity tables are not covered by `auth.uid()` RLS because login must read a user before a subject exists. End users never receive that role.
- EF migration `IdentityInitial` creates `identity.users` before the ported domain SQL. `db/fly/0010_identity.sql` is the idempotent review script.

## Import and rollback

- No export was run. The import command reads a local JSON file and refuses any path that contains `://`.
- `IdentityImport:Mode` must be `rehearsal` or `approved-cutover`. Any other value, including empty, refuses the import. `rehearsal` also refuses the Production environment. `approved-cutover` revokes sessions for the imported users; rehearsal does not.
- The planner aborts on duplicate ids, invalid email, normalized-email collision, missing provider subject, issuer+subject collision and row-count mismatch. It does not drop rows. A repeated import of the same file hash returns the stored plan.
- `$2a$` and `$2b$` bcrypt hashes verify and return `SuccessRehashNeeded`. `$2y$`, argon2 and Firebase scrypt stay stored and require reset. A banned account with an unsupported hash gets `account_unavailable` rather than a reset prompt. Passwords longer than 72 UTF-8 bytes do not match. Identity hashes that already start with `AQAAAA` are not replaced by an older bcrypt hash.
- MFA factors set `MfaReenrollmentRequired` and do not persist the old secret. Password alone does not mint a token.
- Existing sessions and pending links are not copied. They are revoked only when the import mode is `approved-cutover`. This build does not accept the old issuer. Pointing clients here still requires a separate approval.
- Rollback is restore of the direct-endpoint `pg_dump` taken before import, then point clients back. Do not delete the source project as part of this review.
- The synthetic rehearsal file is `backend/tests/InOut.Api.Tests/Fixtures/synthetic-identity.json`. It is not a live export.

## Database rehearsal

`dotnet run --project src/InOut.Api -- migrate` reads only `ConnectionStrings__InOutDirect` and returns before the web host is built. Identity columns are snake_case, so domain foreign keys reference `identity.users(id)`. A SQL file must not issue its own `COMMIT`; the migrator records the file hash in the same transaction.

On a disposable local PostgreSQL 16.15 (not Fly Managed Postgres), the command applied 36 files (`0000`, 34 domain files, `9010`) and a second run exited 0 without reapplying them. `identity.users.id` is the target of the ownership foreign keys. `anon`, `authenticated`, `service_role` and `inout_api_runtime` are `NOLOGIN`, `NOSUPERUSER` and `NOBYPASSRLS`. 107 policies are installed.

A local session as `inout_api_runtime`, with `set_config('request.jwt.claim.sub', ..., true)` on that same transaction, inserted one household per subject. Each subject saw only its own household and membership. An insert whose `created_by` was the other user failed with `new row violates row-level security policy for table "households"`. An empty subject saw zero households. The role was set back to `NOLOGIN` after the check. This does not replace the Testcontainers suite and was not run on Fly.

## Verified here

- `dotnet test InOut.sln --filter "FullyQualifiedName!~EfLedgerStore"`: Domain 98 passed, Architecture 3 passed, API 49 passed, 0 failed. The API count includes legacy bcrypt/`$2b$`/`$2y$`/argon/Firebase/72-byte/Unicode checks, the import planner, register/confirm/reset/refresh/revocation, MFA re-enrollment, mobile PKCE, pool settings, and the synthetic fixture rehearsal.
- `dotnet format InOut.sln --verify-no-changes`: formatted 0 files.
- `cd frontend && npm run check`: prettier, eslint and `next typegen && tsc --noEmit` succeeded. `npm test`: 114 passed.
- `cd mobile && npm run check`: prettier, eslint and `tsc --noEmit` succeeded. `npm test`: 112 passed.
- `bash tool/check_no_hosted_auth_runtime.sh`: no hosted-auth runtime references outside historic docs, including lockfiles.
- Local PostgreSQL 16.15 migration and the two-subject RLS check above.

## Blocked / unverified

- No Fly organization, Managed Postgres cluster, region capacity, SMTP, or production certificates were available. Startup is fail-closed without them. `gru` remains an unapproved candidate.
- No staging request was sent. No region sample, and no warm or cold p50/p95, is reported.
- Live row counts were not exported or compared. No production cutover was performed.
- Docker is not available here, so `EfLedgerStoreIntegrationTests` (Testcontainers) did not run. Domain tests cover the invite rules in memory. The local RLS check covers household select and forged `created_by` only.
- Web and mobile screens were not exercised in a browser or on a device. Typecheck, lint and unit tests passed.
