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
- [Estrutura inicial do projeto Flutter](docs/07-project-structure.md)
- [Ambientes, dependências e integração contínua](docs/08-environments-and-ci.md)
- [Banco de dados e isolamento por residência](docs/09-database-security.md)
- [Registro de decisões arquiteturais](docs/adr/README.md)

## Desenvolvimento

O cliente usa Flutter para Android, iOS e Web/PWA. Os casos de uso são publicados por uma API ASP.NET Core; Supabase fornece PostgreSQL e Auth. O Flutter não implementa regras financeiras nem cria novas dependências de RPCs de negócio.

```bash
flutter pub get
flutter analyze
flutter test
flutter run -d chrome
```

Consulte a [estrutura inicial](docs/07-project-structure.md) e o [ADRs da stack e do backend](docs/adr/README.md) antes de adicionar novos módulos ou dependências.

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
