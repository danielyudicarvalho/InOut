# ADR-002: Ledger balanceado e imutável

- Status: aceita
- Data: 2026-09-08

## Contexto

Editar ou excluir movimentos passados dificulta explicar divergências e descobrir quem corrigiu um erro. Transferências também podem produzir saldos parciais se forem persistidas como alterações independentes.

## Decisão

Representar fatos financeiros por transações com entradas cuja soma é zero. Movimentos contabilizados são imutáveis. Correções usam estorno inverso ligado ao original e, quando necessário, novo lançamento. Todas as pernas são persistidas atomicamente.

## Consequências

O histórico permanece auditável e saldos são recalculáveis. A interface precisa explicar estornos com clareza. Consultas devem excluir o efeito líquido de pares revertidos de acordo com as fórmulas canônicas, sem ocultar o histórico.