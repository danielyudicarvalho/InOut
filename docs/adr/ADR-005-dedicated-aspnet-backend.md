# ADR-005: Backend dedicado ASP.NET para regras de negócio

- Status: aceita
- Data: 2026-09-09
- Substitui parcialmente: ADR-003

## Contexto

O desenho inicial usava Flutter com Supabase/PostgreSQL e funções SQL para operações atômicas. Com o crescimento do domínio financeiro, concentrar casos de uso em RPCs dispersaria regras entre Dart e SQL, aumentaria acoplamento ao banco e reduziria a clareza dos limites arquiteturais.

## Decisão

Construiremos uma API ASP.NET Core como monólito modular. O domínio e os casos de uso serão escritos em C#. A infraestrutura adaptará EF Core/Npgsql, PostgreSQL, Supabase Auth e serviços operacionais. A API publicará contratos HTTPS/JSON documentados por OpenAPI.

O Supabase continuará responsável por PostgreSQL gerenciado, Auth, migrations, RLS, constraints, índices, transações e backups. O Flutter continuará obtendo a sessão pelo Supabase Auth, mas enviará o JWT à API. Novos casos de uso de negócio não serão implementados como RPCs nem como escrita direta do cliente.

## Limites

- `InOut.Domain`: entidades, value objects, políticas e invariantes; sem ASP.NET, EF Core ou Supabase.
- `InOut.Application`: comandos, consultas, autorização, idempotência, unidades de trabalho e portas.
- `InOut.Infrastructure`: PostgreSQL, EF Core/Npgsql, Auth, clock, IDs, logs e exportação.
- `InOut.Api`: endpoints, contratos, autenticação, validação de formato e Problem Details.
- Flutter: UI, estado, cliente HTTP e DTOs; sem regras financeiras autoritativas.

## Segurança

A API valida assinatura, issuer, audience e expiração do JWT, resolve a associação em `household_members` e não aceita `household_id` como prova isolada. A conexão de runtime terá menor privilégio. RLS e constraints permanecem como defesa em profundidade. Nenhuma chave privilegiada será exposta ao Flutter.

## Migração

1. Congelar novas RPCs de negócio.
2. Inventariar RPCs e acessos diretos.
3. Criar testes de caracterização.
4. Migrar por módulo e fatia vertical.
5. Trocar o adaptador Flutter.
6. Observar e reconciliar.
7. Desativar o legado e revogar permissões somente após paridade e rollback comprovados.

## Consequências

Benefícios: domínio explícito e testável, contratos HTTP estáveis, melhor autorização e observabilidade, menor acoplamento ao provedor.

Custos: novo build e deploy, maior carga operacional, latência adicional e necessidade de migração cuidadosa.

## Não objetivos

Microsserviços, CQRS distribuído, event sourcing, outro banco, remoção de RLS ou reescrita big-bang.

## Critérios de sucesso

- nenhum novo caso de uso de negócio em RPC;
- Domain independente de frameworks;
- Flutter sem escrita direta nos fluxos migrados;
- integração cobrindo autorização negativa, idempotência e atomicidade;
- OpenAPI, health checks, logs e CI ativos;
- legado removido somente após corte seguro.

## Referência

A decisão segue os capítulos de DDD, arquitetura hexagonal e Clean Architecture do livro *Full Cycle*: o domínio fica no centro; banco, framework e interface são adaptadores.
