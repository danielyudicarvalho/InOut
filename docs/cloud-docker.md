# API and web against Fly Managed Postgres

Copy `cloud.env.example` to `.env.cloud` and do not commit it. Set the runtime connection to the session pooler and the direct connection to `direct.*.flympg.net`. Both require TLS. Do not use the database owner for the API.

The web service needs `API_BASE_URL`, `AUTH_WEB_CLIENT_SECRET` and `BFF_SESSION_KEY` (32 bytes, base64). Production also requires signing and encryption certificates, SMTP, an approved region and a cluster connection budget. See `docs/fly-identity-migration.md`.

This compose file is a review configuration. It does not provision Fly, migrate live data, or choose a region.
