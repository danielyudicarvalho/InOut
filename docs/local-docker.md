# Local API and web

Prerequisites: Docker Compose and a disposable Postgres reachable from the host. This repository does not start a hosted-auth stack.

```bash
export INOUT_DIRECT_URL='Host=127.0.0.1;Port=5432;Database=inout;Username=postgres;Password=postgres'
bash tool/local-up.sh
docker compose up --build
```

Open http://localhost:3000. API liveness is http://localhost:8080/health/live. The browser calls the Next server. `API_BASE_URL` inside the web container points at the API service. Do not put database passwords or the web client secret in a public bundle.

`inout_api_runtime` stays `NOBYPASSRLS`. Give it a password outside Git before the API serves traffic. Migrations use the direct URL, not the pooler.
