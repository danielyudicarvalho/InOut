# Run InOut locally with Docker

Prerequisites: Docker Engine with Compose v2 and Supabase CLI. The database and Auth containers are managed by the existing Supabase CLI configuration, so the repository migrations and user identities stay consistent. The ASP.NET API and Next.js web client run in Compose containers.

From the repository root:

```bash
bash tool/local-up.sh
```

Open http://localhost:3000. The API liveness endpoint is http://localhost:8080/health/live and the local Supabase API is http://localhost:54321. PostgreSQL is available at localhost:54322. The first run downloads images and builds both applications. Supabase applies the migrations; the script enables the migration-created `inout_api_runtime` role with a local-only password. The script writes `.env.docker.local` (ignored by Git), containing the local JWT secret and anon key.

To stop the stack while keeping database contents:

```bash
docker compose --env-file .env.docker.local down
supabase stop
```

For a fresh database (deletes local data): `supabase db reset`, then rerun `bash tool/local-up.sh` to enable the runtime login again. The browser uses `localhost` for API and Auth because it runs on the host, while the API container connects to the database through `host.docker.internal`. On Linux, Compose maps that name to the Docker host gateway.

Local Supabase signs JWTs with HS256. The backend accepts that local secret only when `ASPNETCORE_ENVIRONMENT=Development` and `Supabase:Jwt:LocalSecret` is set; deployed environments continue to require HTTPS issuer and asymmetric JWKS signing. Do not use the local secret or database password outside this development stack.

## Logs

The API writes standard output and errors to the persistent `api_logs` volume (`api.log`). The Next.js web container writes logs to `web_logs` (`web.log`). Both services also retain `docker compose logs` output. These named volumes survive `docker compose down`; avoid `down --volumes` if you need them.

Export both volumes to ignored host files:

```bash
bash tool/export-docker-logs.sh cloud
# For the isolated Supabase mode: bash tool/export-docker-logs.sh local
```

The resulting paths are `logs/api/api.log` and `logs/web/web.log`. They may contain personal data or request paths, so keep them private.
