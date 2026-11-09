# GOM-84 — Evidência de estorno, relançamento e histórico

## Resultado

Correções financeiras preservam os fatos contabilizados:

1. o lançamento original permanece no histórico com status `reversed`;
2. o estorno é uma nova transação `reversal`, referencia o original por `reversalOf` e contém entradas exatamente inversas;
3. o relançamento correto é uma nova receita ou despesa `posted`, com sua própria chave de idempotência;
4. o saldo deriva dos três fatos, sem edição ou exclusão do original.

O contrato de histórico da API e o modelo Flutter agora expõem `reversalOf`, permitindo apresentar e auditar a cadeia de correção.

## Proteções

- o registro original é bloqueado com `FOR UPDATE` durante o estorno;
- somente transações `posted` podem ser estornadas;
- duas tentativas concorrentes produzem apenas um estorno;
- original, estorno e relançamento permanecem consultáveis;
- o processo inteiro usa transações PostgreSQL e chaves de idempotência.

## Testes relevantes

- `FinancialTransactionTests.ReversalCreatesOppositeEntriesAndReferencesOriginal`;
- `FinancialTransactionTests.ReversalRejectsAnAlreadyReversedTransaction`;
- `EfLedgerStoreIntegrationTests.ConcurrentReversalsAllowOnlyOneReversal`;
- `EfLedgerStoreIntegrationTests.ReversalAndRepostRemainVisibleAsAnAuditableCorrectionChain`;
- teste Flutter `maps the original transaction referenced by a reversal`.
