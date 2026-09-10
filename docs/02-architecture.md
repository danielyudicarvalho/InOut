> **Atualização arquitetural — 2026-09-09:** o backend dedicado ASP.NET Core passa a ser a única porta para casos de uso de negócio. Supabase permanece como PostgreSQL gerenciado, Auth e defesa em profundidade por RLS/constraints. Consulte [ADR-005](adr/ADR-005-dedicated-aspnet-backend.md).

# Arquitetura e decisões

## Resumo da solução

O InOut adota um **monólito modular ASP.NET Core**, um cliente Flutter e um único banco PostgreSQL. Essa escolha é coerente com dois usuários, prazo de sete dias e baixa escala. O livro *Full Cycle* reforça que monólitos não são inerentemente ruins e que decisões devem responder ao contexto e às restrições.

Aplicamos arquitetura limpa de modo pragmático: dependências apontam para as regras de negócio, enquanto interface, autenticação e persistência permanecem substituíveis.

## Limites internos

```text
Flutter -> HTTPS API
API -> application -> domain
              ^          ^
              |          |
          infrastructure
```

- **domain**: dinheiro, contas, movimentos, categorias, orçamento, metas, estorno e invariantes.
- **application**: casos de uso, autorização da casa, transações e portas.
- **infrastructure**: banco, autenticação, relógio, IDs, logs e exportação.
- **api**: endpoints, contratos HTTP, autenticação e mapeamento de erros.
- **presentation Flutter**: telas, estado de UI, validação de formato e navegação.

O Flutter obtém sessão no Supabase Auth e envia o JWT à API. A API valida o token, resolve usuário e residência, executa o caso de uso C# e persiste via EF Core/Npgsql.

Domain e Application não importam ASP.NET, EF Core, Supabase SDK, Flutter ou detalhes HTTP.

## Módulos do monólito

- **Identity & Household**: usuários, casa, membros e papéis.
- **Ledger**: contas, lançamentos, transferências, estornos e saldos.
- **Classification**: categorias e subcategorias.
- **Planning**: orçamentos, metas e projetos.
- **Reporting**: consultas, painel e exportação.
- **Operations**: auditoria, logs, backup e configuração.

No MVP, são módulos internos do mesmo processo ASP.NET e do mesmo banco, não serviços independentes.

## Fluxo de um caso de uso

1. A apresentação recebe e valida o formato.
2. A aplicação identifica o usuário e a casa.
3. O caso de uso carrega entidades por portas/repositórios.
4. O domínio valida invariantes e produz a mudança.
5. A infraestrutura persiste tudo em uma transação.
6. A aplicação retorna um DTO próprio para a apresentação.
7. O sistema registra evento operacional sem expor dados sensíveis.

## Decisões principais

### Banco relacional

O domínio exige consistência entre lançamentos, contas, transferências e estornos. Chaves estrangeiras, constraints e transações são parte da proteção, não substitutos das regras do domínio.

### Saldo derivado

A fonte da verdade é o conjunto de movimentos contabilizados. Um saldo materializado poderá existir por desempenho, mas deve ser reconciliável e nunca ser a única verdade.

### Valores monetários inteiros

Valores são armazenados como inteiros em centavos e acompanhados de moeda. Isso elimina erros de ponto flutuante.

### Imutabilidade contábil

Após contabilizado, um movimento não é editado nem apagado. Erros são corrigidos por um movimento inverso ligado ao original e, se preciso, um novo lançamento correto.

### Multiusuário seguro

Toda entidade de negócio pertence a uma casa. O controle de acesso é aplicado na borda da aplicação e reforçado no banco. Identificadores enviados pelo cliente nunca bastam como autorização.

### Operação proporcional

Sem Kubernetes, service mesh, filas ou observabilidade distribuída. O necessário é ambiente reproduzível, CI, logs estruturados, captura de erros, health check, backup e restauração ensaiada.

## Dependências permitidas

| Origem | Pode depender de |
|---|---|
| Domain | Biblioteca padrão e módulos internos do domínio |
| Application | Domain e contratos/portas |
| Infrastructure | Application, Domain e ferramentas externas |
| Presentation | Application e DTOs de apresentação |

## Estrutura sugerida

```text
src/
  domain/
  application/
  infrastructure/
  presentation/
tests/
  unit/
  integration/
  e2e/
docs/
  adr/
```

A estrutura final pode seguir as convenções do framework escolhido, desde que preserve essas direções de dependência.

## Política de RPCs e acesso direto

- Novos casos de uso de negócio não serão implementados como RPC Supabase.
- RPCs e acessos diretos existentes serão inventariados, caracterizados e migrados incrementalmente.
- O Flutter não gravará tabelas financeiras diretamente após a migração do fluxo.
- RLS e constraints permanecem como defesa em profundidade.
- Nenhum caminho antigo será removido antes de paridade, observabilidade e rollback comprovados.

## Estrutura do backend

```text
backend/
  InOut.sln
  src/InOut.Api/
  src/InOut.Application/
  src/InOut.Domain/
  src/InOut.Infrastructure/
  tests/
```

## Evolução intencional

A arquitetura mantém abertas as opções de trocar UI, autenticação, banco hospedado ou mecanismo de exportação. Não tenta antecipar escala inexistente. Novos limites só serão introduzidos diante de evidência: crescimento do domínio, conflito de ciclos de entrega, necessidade operacional ou carga real.