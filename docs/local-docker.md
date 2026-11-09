# Local Full-Stack Docker (DB, Backend, Frontend, and Mobile)

This repository includes a complete, containerized local environment running all tiers without requiring local .NET or PostgreSQL installations.

## Quick Start

```bash
docker compose up --build
```

To run in the background (detached):
```bash
docker compose up --build -d
```

To stop all services:
```bash
docker compose down
```

To stop and wipe database volume (clean slate):
```bash
docker compose down -v
```

## Services and Ports

| Service | Port | Description | Healthcheck / Endpoint |
|---|---|---|---|
| **db** | `5432` | PostgreSQL 16 with `pgcrypto` and auto-initialized `inout_api_runtime` role | `pg_isready -U postgres -d inout` |
| **migrator** | *internal* | Runs EF Core and SQL schema migrations (`0000_roles_and_crypto.sql`, `migrations/*.sql`, `9010_runtime_grants.sql`) before API starts | Exits 0 on completion |
| **api** | `8080` | ASP.NET Core 10 API & OpenIddict Auth Server | `http://localhost:8080/health/live` |
| **web** | `3000` | Next.js 16 Web Frontend (BFF with encrypted session cookies) | `http://localhost:3000` |
| **mobile** | `8081` | Expo Mobile App Web Preview | `http://localhost:8081` |

## Environment Overrides (Optional)

You can customize passwords and secrets using shell variables or a `.env` file:
- `INOUT_DIRECT_PASSWORD`: PostgreSQL superuser password (default: `postgres`)
- `INOUT_DB_PASSWORD`: Password for `inout_api_runtime` role (default: `inout_runtime_pass`)
- `AUTH_WEB_CLIENT_SECRET`: Shared confidential secret between Web BFF and API (default: `dev-only-web-client-secret`)
- `BFF_SESSION_KEY`: Base64 32-byte key for AES-GCM session cookie encryption (in development, falls back to a deterministic dev key)
