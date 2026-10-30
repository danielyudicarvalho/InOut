# Estrutura do Projeto InOut

## Targets da Aplicação

- **Frontend Web**: Next.js 16 (`frontend/`) para navegador e PWA.
- **Mobile**: React Native com Expo (`mobile/`) para Android e iOS nativos.
- **Backend API**: ASP.NET Core 10 (`backend/`) para publicação de contratos e casos de uso de negócio.
- **Pacotes Compartilhados**: `packages/identity/` para contratos e fluxos de autenticação desacoplados.

## Camadas e Limites

```text
frontend/         Next.js App Router, componentes React e rotas de UI
mobile/           React Native + Expo, telas e fluxos mobile
packages/         Lógica e portas compartilhadas (ex.: packages/identity)
backend/src/
  InOut.Domain/          Regras e tipos puros de negócio financeiro
  InOut.Application/     Casos de uso e portas de aplicação
  InOut.Infrastructure/  Persistência EF Core / Npgsql e integrações
  InOut.Api/             Endpoints ASP.NET Core, middleware e contratos
```

## Regras de Dependência

1. As interfaces (`frontend/` e `mobile/`) interagem com o Supabase Auth para sessão e enviam o JWT autenticado para a API ASP.NET Core.
2. A API valida o JWT (via Supabase JWKS) e executa as regras financeiras autoritativas.
3. As interfaces web/mobile não implementam regras financeiras nem acessam tabelas de negócio diretamente.

## Comandos de Validação

### Frontend
```bash
cd frontend
npm ci
npm run check
npm run build
```

### Mobile
```bash
cd mobile
npm ci
npm run check
```

### Backend
```bash
cd backend
dotnet test InOut.sln
```
