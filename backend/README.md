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

`InOut.Infrastructure` usa EF Core para mapeamento relacional, consultas e
persistência comum. SQL parametrizado permanece somente nas fronteiras
específicas do PostgreSQL: contexto transacional de RLS e locks de linha nos
fluxos concorrentes de convite.

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

- `ConnectionStrings__InOut`: conexão PostgreSQL do papel `inout_api_runtime` no pooler de sessão;
- `ConnectionStrings__InOutDirect`: endpoint direto para migrations, sem pooler;
- `Auth__Issuer` e `Auth__PublicOrigin`: URLs públicas do emissor e do web;
- `Deployment__RegionApproved`: precisa ser `true` em produção, com região e capacidade explícitas;
- `Cors__AllowedOrigins__0` (e seguintes): origens HTTPS permitidas.

A API emite e valida tokens de referência do OpenIddict. O `sub` é a única identidade usada; nome de exibição e metadados do cliente não concedem autorização.

`dotnet run --project src/InOut.Api -- migrate` aplica o schema pelo endpoint direto. `dotnet run --project src/InOut.Api -- import caminho/local.json` importa um arquivo local já exportado. O comando recusa URL remota e recusa quando `IdentityImport__Mode` não é `rehearsal` ou `approved-cutover`. `rehearsal` também recusa o ambiente Production. O modo `approved-cutover` revoga sessões dos usuários importados; o ensaio não. Nenhum dos dois exporta dados ao vivo nem apaga a conta de origem. O ensaio sintético está em `tests/InOut.Api.Tests/Fixtures/synthetic-identity.json`.

### Usuário de runtime

A migration cria `inout_api_runtime` como `NOLOGIN`, `NOSUPERUSER` e
`NOBYPASSRLS`. O papel recebe somente os privilégios exigidos pelas fatias
Identity & Household e Ledger; não recebe `DELETE` no ledger nem acesso a
budgets/goals. Habilite o
login e defina sua senha diretamente no ambiente operacional, nunca em uma
migration ou no Git:

```sql
alter role inout_api_runtime login password '<secret-from-secret-manager>';
```

Cada consulta de autorização define `request.jwt.claim.sub` apenas dentro da
transação. A política RLS exige que esse sujeito coincida com `user_id`, e a
consulta repete explicitamente o par `(household_id, user_id)`.

O corte operacional e o rollback são definidos no
[runbook histórico da GOM-101](../docs/history/superseded/runbooks/gom-101-legacy-cutover.md) e o [plano de migração](../docs/fly-identity-migration.md).

## Identity & Household API

- `GET /api/v1/households`
- `POST /api/v1/households`
- `POST /api/v1/households/{householdId}/invitations`
- `POST /api/v1/household-invitations/accept`

Todos exigem `Authorization: Bearer <access token>`. Convites contêm 24
bytes aleatórios, são persistidos somente como SHA-256, expiram em 24 horas e
são consumidos uma única vez. Escritas, auditoria e locks ocorrem na mesma
transação PostgreSQL.

## Accounts & Ledger API

- `POST /api/v1/households/{householdId}/ledger/accounts`
- `GET /api/v1/households/{householdId}/ledger/accounts`
- `DELETE /api/v1/households/{householdId}/ledger/accounts/{accountId}` (arquiva)
- `GET /api/v1/households/{householdId}/ledger/history`
- `GET /api/v1/households/{householdId}/ledger/balances`
- `GET /api/v1/households/{householdId}/ledger/dashboard?year={year}&month={month}`

O saldo inicial é persistido como `opening_balance`, não como estado mutável da
conta. Saldos são derivados das entries contabilizadas. O runtime pode criar e
arquivar contas, mas não recebe `DELETE`; o histórico mantém autor, data, tipo e
as pernas de cada movimento.

Operações mutáveis recebem `Idempotency-Key`. A intenção é registrada na tabela
genérica `private.idempotency_requests`, com escopo por residência e operação,
fingerprint do payload, estado, lease e resultado semântico. Chave, mutação,
auditoria e Outbox são persistidos atomicamente. Identidades e constraints de
domínio continuam independentes da chave; consulte a ADR-006.

## Limites

Domain e Application não podem depender de ASP.NET Core, EF Core, Npgsql ou frameworks de interface. Os testes de arquitetura bloqueiam violações básicas dessa direção.
