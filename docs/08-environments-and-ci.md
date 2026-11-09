# Ambientes, dependências e integração contínua

## Toolchain canônica

- Node.js 22 LTS / 24 LTS e npm para `frontend/`, `mobile/` e `packages/identity`;
- .NET 10 SDK para `backend/`;
- .NET SDK 10 e Postgres para migrations em `db/fly` e testes de RLS;
- Docker com Docker Compose v2 para execução local integrada.

Mudanças de dependências devem ocorrer em PR própria, com lockfiles atualizados (`package-lock.json`, `Directory.Packages.props`).

## Configuração local

Copie `cloud.env.example` para `.env.cloud` e preencha para desenvolvimento com banco hospedado, ou use `tool/local-up.sh` para banco local. Arquivos `.env*`, credenciais de banco e chaves de assinatura nunca devem ser versionados.

O web não publica segredo. O mobile publica só o issuer. A API recebe o access token de referência e aplica o sujeito na mesma transação da consulta.

## Pipeline de CI

As workflows no GitHub Actions cobrem:
1. **Security & Database (`ci.yml`)**:
   - Verificação de segredos e logging sensível (`check_secrets.sh`, `check_logging_privacy.sh`);
   - Aplicação de migrations, lint de banco, testes RLS e drill de backup/restauração.
2. **Backend CI (`backend-ci.yml`)**:
   - Restauração de dependências, compilação Release e testes automatizados da suíte .NET.
3. **UI Quality (`ui-quality.yml`)**:
   - Linting, formatação Prettier, typecheck e testes de unidade para `frontend` e `mobile`.

## Comandos equivalentes locais

### Frontend e Mobile
```bash
npm run check --prefix frontend
npm run check --prefix mobile
```

### Backend
```bash
cd backend
dotnet test InOut.sln
```
