# InOut

Aplicativo simples de contabilidade doméstica para duas pessoas, desenvolvido em uma semana com foco em clareza financeira, integridade dos dados e manutenção sustentável.

## Objetivo

Registrar entradas, saídas e transferências; organizar categorias e subcategorias; corrigir lançamentos sem apagar o histórico; acompanhar orçamento, metas e indicadores da casa; e manter uma base compartilhada entre o casal.

## Princípios

- Simples para usar todos os dias.
- Correto antes de sofisticado.
- Um monólito modular ASP.NET, sem microsserviços.
- Regras financeiras implementadas no domínio C#, independentes da interface e do banco.
- Histórico auditável: correções por estorno e relançamento.
- Segurança e privacidade proporcionais a dados financeiros pessoais.
- Entregas pequenas, testadas e reproduzíveis.

## Documentação

- [Visão, escopo e requisitos](docs/01-vision-and-scope.md)
- [Arquitetura e decisões](docs/02-architecture.md)
- [Domínio financeiro e integridade](docs/03-financial-domain.md)
- [Plano de entrega em sete dias](docs/04-one-week-plan.md)
- [Qualidade, segurança e operação](docs/05-quality-security-operations.md)
- [Design visual e sistema de cores](docs/06-visual-design.md)
- [Ambientes, dependências e integração contínua](docs/08-environments-and-ci.md)
- [Banco de dados e isolamento por residência](docs/09-database-security.md)
- [Migração para Fly Managed Postgres e Identity](docs/fly-identity-migration.md)
- [Inventário histórico do provedor anterior](docs/history/10-previous-provider-boundary-inventory.md)
- [Runbook histórico do corte dos caminhos legados](docs/history/superseded/runbooks/gom-101-legacy-cutover.md)
- [Registro de decisões arquiteturais](docs/adr/README.md)

## Desenvolvimento

A aplicação é composta por:
- **Frontend Web**: Next.js 16 (`frontend/`)
- **Mobile (Android/iOS)**: React Native + Expo (`mobile/`)
- **Backend API**: ASP.NET Core 10 (`backend/`)
- **Banco e Auth**: Fly Managed Postgres, ASP.NET Core Identity e OpenIddict no monólito

### Docker: API and web BFF

The browser talks only to the Next server. `API_BASE_URL`, `AUTH_WEB_CLIENT_SECRET` and `BFF_SESSION_KEY` stay on the server. The API uses `ConnectionStrings__InOut` for the runtime role and `ConnectionStrings__InOutDirect` for migrations.

```bash
cp cloud.env.example .env.cloud
# Fill in the project URL, publishable key, and restricted database connection string.
docker compose -f compose.cloud.yaml --env-file .env.cloud up --build -d
```

See [cloud setup](docs/cloud-docker.md) and [local setup](docs/local-docker.md). Region, latency and a live cutover are not claimed by this repository.

### Frontend Web (Next.js)

```bash
cd frontend
npm ci
npm run dev
```

### Mobile (React Native + Expo)

```bash
cd mobile
npm ci
npm start
```

### Backend (.NET)

```bash
cd backend
dotnet restore InOut.sln
dotnet build InOut.sln --configuration Release --no-restore
dotnet test InOut.sln --configuration Release --no-build
dotnet run --project src/InOut.Api/InOut.Api.csproj
```

Consulte os [ADRs da stack e do backend](docs/adr/README.md) e o [guia do backend](backend/README.md) antes de adicionar módulos ou dependências.

## Escopo do MVP

1. Autenticação e casa compartilhada.
2. Contas e saldos.
3. Entradas, despesas e transferências.
4. Categorias e subcategorias customizáveis.
5. Correção por estorno e relançamento.
6. Orçamento mensal, meta de economia e visão consolidada.
7. Painel básico com saldo, receitas, despesas e distribuição por categoria.
8. Exportação dos dados em CSV.

## Fora do MVP

Integração bancária, OCR de comprovantes, cartões/faturas complexos, investimentos com cotação, IA, multi-moeda, contabilidade fiscal, microserviços e BI avançado.

## Referência arquitetural

As decisões adotam de forma proporcional os princípios do livro *Full Cycle*: sustentabilidade desde o dia zero, requisitos arquiteturais explícitos, organização e componentização, linguagem de domínio, separação entre negócio e tecnologia, limites arquiteturais, automação de entrega e observabilidade.

## Novos clientes de UI/UX — branch `UI`

- [Web em Next.js (`frontend/`)](frontend/README.md).
- [Android/iOS em React Native + Expo (`mobile/`)](mobile/README.md).
- [ADR-009: decisão e limites desta entrega](docs/adr/009-react-ui-clients.md).

A primeira tela implementa as boas-vindas da referência Ninho/Pipo. Os CTAs apresentam a continuidade planejada; autenticação e demais telas serão integradas nas próximas entregas.
