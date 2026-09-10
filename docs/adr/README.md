# Registros de decisões arquiteturais

Use um ADR para decisões difíceis de reverter ou que alterem limites, dados, segurança, operação ou dependências importantes.

## Formato

```markdown
# ADR-NNN: Título

- Status: proposta | aceita | substituída
- Data: AAAA-MM-DD

## Contexto

Qual problema e quais restrições motivam a decisão?

## Decisão

O que foi decidido?

## Consequências

Quais benefícios, custos, riscos e próximos passos surgem?
```

## Decisões iniciais

- ADR-001: arquitetura como monólito modular.
- ADR-002: ledger balanceado e movimentos contabilizados imutáveis.
- [ADR-003: stack multiplataforma e hospedagem do MVP](ADR-003-application-stack-and-hosting.md) — aceita.
- ADR-004: autenticação Supabase e associação segura à residência por convite opaco — aceita.
- [ADR-005: backend dedicado ASP.NET](ADR-005-dedicated-aspnet-backend.md) — aceita; substitui o uso de RPCs/Supabase como sede dos casos de uso.
