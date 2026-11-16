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
| Web cookie/SSR session | No | Next BFF, opaque HMAC `inout_session` cookie, server-side `identity.browser_sessions`, CSRF, tokens stay on the server |
| Mobile token storage | AsyncStorage | System browser, authorization code, S256 PKCE, SecureStore, no native secret |
| OAuth providers | Not used by the clients | Not implemented; provider issuer+subject can be imported |
| MFA | Not used by the clients | Imported factors require emailed recovery before TOTP re-enroll; enrolled TOTP is a second web/mobile step |
| Storage buckets | Disabled | No replacement; none was in use |
| Edge functions | None | None |
| Realtime client subscriptions | Publication existed; no client subscriber | Not replaced; no client caller |
| SQL functions, triggers, RLS | Yes | Ported to `db/fly` and still enforced with `private.auth_uid()` |
| Email | Confirm and recovery | SMTP required in production; capture delivery refused there |

## Runtime shape

- Identity owns membership, login and recovery. OpenIddict is only the protocol machinery.
- Web confidential client `inout-web`. Mobile public client `inout-mobile`.
- Access tokens last 10 minutes. Refresh tokens last 14 days, roll, and are revoked by security stamp on reset or explicit revocation. Browser sessions have an absolute 14-day cap and a single-flight refresh claim.
- Login tickets and email codes are consumed with one `UPDATE ... WHERE consumed_at IS NULL ... RETURNING` (EF `ExecuteUpdate` on SQLite tests). Security stamps bind tickets and challenges to the current user.
- Rate limits for `/api/v1/identity`, `/account`, and `/connect/{authorize,token,logout,userinfo}` are stored in `identity.auth_attempts` (IP and per-account). Stale `auth_attempts` windows are deleted on migrate and on each budget increment. The BFF forwards `x-inout-client-ip` with HMAC timestamp+nonce (`Auth:BffIpKey` / `BFF_IP_KEY`). Production BFF refuses to start without `BFF_IP_KEY` and does not read `x-real-ip`. `Fly-Client-IP` is trusted only when `RemoteIpAddress` is Fly 6PN (`fdaa::/16`) or loopback. `X-Forwarded-For` is not enabled. `X-Forwarded-Proto` is trusted only from loopback (default KnownProxies) or Fly 6PN (`KnownIPNetworks` `fdaa::/16`) when `Deployment:TrustFlyProxy` is true. Public internet peers cannot set the scheme.
- Data Protection keys are stored in `identity.data_protection_keys` and encrypted at rest with `Auth:DataProtectionCertificatePem` outside Development. Signing, encryption, and Data Protection certificates are required in Production and Staging. Development ephemeral certificates stay Development-only. `DisableTransportSecurityRequirement` is not configurable outside Development. Fly private HTTP is treated as HTTPS for `Auth:InternalHttpHosts` from loopback or Fly 6PN (`fdaa:`), and for any Host when `TrustFlyProxy` is set and `X-Forwarded-Proto: https` arrives from those same addresses. Public Fly hostnames therefore see `Request.IsHttps`, HSTS, Secure cookies, and OpenIddict HTTPS-only.
- OpenIddict clients are upserted during `migrate` (and SQLite `EnsureCreated` for tests), not on API boot. First-boot `CreateAsync` retries on a unique-constraint race. `Auth:RotateWebClientSecret` rotates the web secret. Current plus next signing/encryption certificates are loaded when `Auth:*CertificateNextPem` is set.
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
- MFA factors set `MfaReenrollmentRequired` and do not persist the old secret. Password alone does not mint a token and does not issue an enroll ticket. Re-enrollment starts from an emailed recovery code plus the current password. Hosted `/account/reset` always calls `ResetPasswordAsync` after exchanging the code, including MFA-import users, so the form password is hashed before enroll. GET `/account/mfa` reads the existing authenticator key and does not rotate it. TOTP check, failure increment, and consume share one transaction; the same RFC 6238 time-step cannot be reused (`LastTotpStep`). TOTP failures call `AccessFailedAsync` and the account budget, so a new login does not hand out a fresh five-guess ticket after lockout. Password reset runs Identity password validators. Web BFF `/api/auth/mfa` completes the second factor; hosted `/account/mfa` keeps the ticket in an HttpOnly cookie, not the query string. `CreateAuthenticatedAsync` binds the session to the token subject, not a posted `userId`.
- Existing sessions and pending links are not copied. They are revoked only when the import mode is `approved-cutover`. This build does not accept the old issuer. Pointing clients here still requires a separate approval.
- Rollback is a Fly Managed Postgres restore. The production backup path (MPG built-in vs an in-Fly job) is pending Daniel's decision and was not chosen in this review. GitHub Actions must not dump a public database URL or upload PII artifacts. `tool/backup_database.sh` and `tool/restore_database.sh` refuse `flympg.net`, `fly.dev`, `*.internal`, `*.flycast`, and localhost/`fly proxy` URLs unless `INOUT_ALLOW_LOCAL_BACKUP=yes`. Encrypt with `BACKUP_PASSPHRASE`. Restore does not require SUPERUSER. The drill uses local port 5432, never 54322. Do not run any of this against live data from this review.
- `fly.toml` `[deploy] release_command = 'migrate'` runs `dotnet InOut.Api.dll migrate`, which sets `lock_timeout = 15s` then takes `pg_advisory_lock(88112010)` on the direct connection before EF, `db/fly` files, `auth_attempts` TTL delete, and OpenIddict client upsert. The API image copies `db/` and forwards `migrate`/`import` through `backend/docker-entrypoint.sh`. Container logs are not teed to an uncapped file. `/health/live` is process liveness; `/health/ready` selects `1` from Postgres. Web `/api/health` is not-ready when `API_BASE_URL` is unset. `/metrics` is loopback or Fly 6PN (`fdaa::/16`) only so Fly can scrape from the private network; it is not a public-internet allowlist.
- The synthetic rehearsal file is `backend/tests/InOut.Api.Tests/Fixtures/synthetic-identity.json`. It is not a live export.

## Database rehearsal

`dotnet run --project src/InOut.Api -- migrate` reads only `ConnectionStrings__InOutDirect` and returns before the web host is built. Identity columns are snake_case, so domain foreign keys reference `identity.users(id)`. A SQL file must not issue its own `COMMIT`; the migrator records the file hash in the same transaction.

On a disposable local PostgreSQL 16.15 (not Fly Managed Postgres), the command applied 36 files (`0000`, 34 domain files, `9010`) and a second run exited 0 without reapplying them. `identity.users.id` is the target of the ownership foreign keys. `anon`, `authenticated`, `service_role` and `inout_api_runtime` are `NOLOGIN`, `NOSUPERUSER` and `NOBYPASSRLS`. 107 policies are installed.

A local session as `inout_api_runtime`, with `set_config('request.jwt.claim.sub', ..., true)` on that same transaction, inserted one household per subject. Each subject saw only its own household and membership. An insert whose `created_by` was the other user failed with `new row violates row-level security policy for table "households"`. An empty subject saw zero households. The role was set back to `NOLOGIN` after the check. CI job `Database migrations and RLS` now reapplies migrate and runs `db/fly/tests/rls_and_schema.sql` against the disposable Postgres service. This does not replace the Testcontainers suite and was not run on Fly.

## Verified here

- See the pull request description for the commands actually run in this review (dotnet test, frontend tests, owed scans).
- `bash tool/check_no_hosted_auth_runtime.sh`: no hosted-auth runtime references outside historic docs, including lockfiles.
- Local PostgreSQL 16.15 migration and the two-subject RLS check above remain the last disposable-DB rehearsal; this review did not reconnect to that database.

## Blocked / unverified

- No Fly organization, Managed Postgres cluster, region capacity, SMTP, or production certificates were available. Startup is fail-closed without them. `gru` remains an unapproved candidate.
- No staging request was sent. No region sample, and no warm or cold p50/p95, is reported.
- Live row counts were not exported or compared. No production cutover was performed.
- Docker is not available in the review agent, so Testcontainers (`EfLedgerStoreIntegrationTests`, `IdentityPostgresTests` parallel UPDATE RETURNING / shared `auth_attempts`) did not run here. CI `database` and `images` jobs are the intended hosts. Domain tests cover invite rules in memory.
- Secret scanning, NuGet vulnerability restore (`CheckSdkVulnerabilities`), CodeQL, and Trivy image scans are wired in CI. They are not a substitute for a paid scanner subscription.
- Base image digest pins and a live Fly MPG backup/restore drill were not executed. Missing Fly org, SMTP, and production certificates remain startup blockers.
- Web and mobile screens were not exercised in a browser or on a device. Typecheck, lint and unit tests are the local evidence.
