# Backend InOut

Monólito modular ASP.NET Core responsável pelos casos de uso e regras de negócio do InOut.

## Projetos

- `InOut.Domain`: entidades, value objects e invariantes.
- `InOut.Application`: casos de uso e portas.
- `InOut.Infrastructure`: adaptadores de persistência e serviços externos.
- `InOut.Api`: contratos HTTP e composição.
- `InOut.Domain.Tests`: testes unitários do domínio.
- `InOut.ArchitectureTests`: direção das dependências.
- `InOut.Api.Tests`: autenticação e autorização HTTP.

## Executar

```bash
cd backend
dotnet restore InOut.sln
dotnet build InOut.sln --configuration Release --no-restore
dotnet test InOut.sln --configuration Release --no-build
dotnet run --project src/InOut.Api/InOut.Api.csproj
```

Em desenvolvimento, o OpenAPI fica disponível em `/openapi/v1.json`. Health checks:

- `/health/live`: processo em execução;
- `/health/ready`: dependências necessárias prontas.

## Configuração

Configuração varia por ambiente e não contém segredos no repositório:

- `ConnectionStrings__InOut`: conexão PostgreSQL do usuário `inout_api_runtime`;
- `Supabase__Jwt__Issuer`: `https://<project-ref>.supabase.co/auth/v1`;
- `Supabase__Jwt__Audience`: `authenticated`;
- `Cors__AllowedOrigins__0` (e seguintes): origens HTTPS permitidas.

O token do Supabase é validado pelo JWKS do projeto, aceitando somente ES256 ou
RS256, com assinatura, emissor, audiência e expiração obrigatórios. O `sub` é a
única identidade usada pela API; `user_metadata` e `household_id` do cliente não
concedem autorização.

### Usuário de runtime

A migration cria `inout_api_runtime` como `NOLOGIN`, `NOSUPERUSER` e
`NOBYPASSRLS`, com acesso somente de leitura a `household_members`. Habilite o
login e defina sua senha diretamente no ambiente operacional, nunca em uma
migration ou no Git:

```sql
alter role inout_api_runtime login password '<secret-from-secret-manager>';
```

Cada consulta de autorização define `request.jwt.claim.sub` apenas dentro da
transação. A política RLS exige que esse sujeito coincida com `user_id`, e a
consulta repete explicitamente o par `(household_id, user_id)`.

## Limites

Domain e Application não podem depender de ASP.NET Core, EF Core, Npgsql, Supabase ou Flutter. Os testes de arquitetura bloqueiam violações básicas dessa direção.
