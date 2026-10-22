# ADR-009: clientes React para a branch UI

- Status: aceita para desenvolvimento de UI/UX
- Data: 2026-10-22

## Contexto

A pedido do proprietário, a branch `UI` passa a concentrar a implementação das novas telas web e Android/iOS. O cliente Flutter existente continua disponível durante essa construção.

## Decisão

- `frontend/`: Next.js App Router, React e TypeScript.
- `mobile/`: React Native com Expo, TypeScript e Continuous Native Generation.
- A primeira entrega é a tela de boas-vindas, baseada na referência fornecida: marca visual Ninho, mascote Pipo, paleta creme/verde e quatro conceitos (entradas, saídas, transferências e residência individual/compartilhada).
- A API ASP.NET permanece como limite das regras financeiras. Esta entrega não faz chamadas autenticadas nem contém regras de saldo.
- Os CTAs abrem explicações de continuidade, explicitamente identificadas como próximas telas. Não simulam login nem criação de residência.
- Não há navegação entre rotas nesta entrega. Ao adicionar novas telas mobile, usar Expo Router conforme `mobile/AGENTS.md`.

## Consequências

Há dois novos clientes a manter. A substituição completa do Flutter e a integração de autenticação serão decisões futuras; esta entrega é apenas a fundação de UI. SDKs e pacotes estão registrados nos lockfiles de cada aplicação.
