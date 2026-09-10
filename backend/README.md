# Backend InOut

Monólito modular ASP.NET Core responsável pelos casos de uso e regras de negócio do InOut.

## Projetos

- `InOut.Domain`: entidades, value objects e invariantes.
- `InOut.Application`: casos de uso e portas.
- `InOut.Infrastructure`: adaptadores de persistência e serviços externos.
- `InOut.Api`: contratos HTTP e composição.
- `InOut.Domain.Tests`: testes unitários do domínio.
- `InOut.ArchitectureTests`: direção das dependências.

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

Configuração varia por ambiente e não contém segredos no repositório. Conexão PostgreSQL, validação JWT e CORS serão introduzidos na GOM-98.

## Limites

Domain e Application não podem depender de ASP.NET Core, EF Core, Npgsql, Supabase ou Flutter. Os testes de arquitetura bloqueiam violações básicas dessa direção.
