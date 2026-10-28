# Run API and Frontend locally with hosted Supabase

This mode starts only the ASP.NET API and Next.js frontend containers. The frontend authenticates against the hosted Supabase project. The API validates its hosted JWTs over HTTPS/JWKS and connects directly to that project's PostgreSQL database.

1. Copy `cloud.env.example` to `.env.cloud` (ignored by Git). Set `SUPABASE_URL` and the project's **publishable/anon** key. Set `INOUT_CLOUD_DATABASE_URL` to an Npgsql connection string using the restricted `inout_api_runtime` login, its password, and `SSL Mode=Require`. Provision that role's login/password securely in the target database first, following `backend/README.md`. Use the Supabase pooler endpoint if your network does not support direct IPv6. Do not use the `postgres` superuser or service role in the API.
2. Ensure all repository SQL migrations have been applied to the target project before using the API. This Compose mode does **not** apply migrations or change database roles.
3. Start the two containers:

```bash
docker compose -f compose.cloud.yaml --env-file .env.cloud up --build -d
```

Open http://localhost:3000; API liveness: http://localhost:8080/health/live. `docker compose -f compose.cloud.yaml --env-file .env.cloud logs -f api` shows backend startup errors. Stop with `docker compose -f compose.cloud.yaml --env-file .env.cloud down`.

**Remote data:** signup, households, ledger writes, and other actions in the local UI/API change the configured hosted project. Use a separate Supabase development project when testing destructive flows. Never check `.env.cloud` into Git. The frontend's publishable key and project URL are embedded in the client build; keep database credentials only in the API container environment.

For an isolated database and local Auth, use `bash tool/local-up.sh` instead; see [local Docker setup](local-docker.md).

## Logs

The API writes standard output and errors to the persistent `api_logs` volume (`api.log`). The Next.js frontend container writes logs to `web_logs` (`web.log`). Both services also retain `docker compose logs` output. These named volumes survive `docker compose down`; avoid `down --volumes` if you need them.

Export both volumes to ignored host files:

```bash
bash tool/export-docker-logs.sh cloud
# For the isolated Supabase mode: bash tool/export-docker-logs.sh local
```

The resulting paths are `logs/api/api.log` and `logs/web/web.log`. They may contain personal data or request paths, so keep them private.
