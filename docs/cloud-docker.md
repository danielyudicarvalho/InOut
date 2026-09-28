# Run API and Flutter locally with hosted Supabase

This mode starts only the ASP.NET API and Flutter web containers. Flutter authenticates against the hosted Supabase project. The API validates its hosted JWTs over HTTPS/JWKS and connects directly to that project's PostgreSQL database.

1. Copy `cloud.env.example` to `.env.cloud` (ignored by Git). Set `SUPABASE_URL` and the project's **publishable/anon** key. Set `INOUT_CLOUD_DATABASE_URL` to an Npgsql connection string using the restricted `inout_api_runtime` login, its password, and `SSL Mode=Require`. Provision that role's login/password securely in the target database first, following `backend/README.md`. Use the Supabase pooler endpoint if your network does not support direct IPv6. Do not use the `postgres` superuser or service role in the API.
2. Ensure all repository SQL migrations have been applied to the target project before using the API. This Compose mode does **not** apply migrations or change database roles.
3. Start the two containers:

```bash
docker compose -f compose.cloud.yaml --env-file .env.cloud up --build -d
```

Open http://localhost:8081; API liveness: http://localhost:8080/health/live. `docker compose -f compose.cloud.yaml --env-file .env.cloud logs -f api` shows backend startup errors. Stop with `docker compose -f compose.cloud.yaml --env-file .env.cloud down`.

**Remote data:** signup, households, ledger writes, and other actions in the local UI/API change the configured hosted project. Use a separate Supabase development project when testing destructive flows. Never check `.env.cloud` into Git. Flutter's publishable key and project URL are intentionally embedded in the web build; keep database credentials only in the API container environment.

For an isolated database and local Auth, use `bash tool/local-up.sh` instead; see [local Docker setup](local-docker.md).
