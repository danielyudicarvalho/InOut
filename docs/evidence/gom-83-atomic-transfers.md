# GOM-83 — Evidência de transferências atômicas

## Resultado

O fluxo `POST /api/v1/households/{householdId}/ledger/transfers` cria uma única transação `transfer` com duas entradas de mesmo valor:

- débito na conta de origem;
- crédito na conta de destino.

As duas entradas são persistidas no mesmo `SaveChangesAsync` e dentro da mesma transação PostgreSQL. Uma falha antes do `CommitAsync` descarta a operação completa.

## Invariantes verificadas

- origem e destino devem ser contas distintas;
- ambas devem estar ativas, usar a moeda informada e pertencer à residência autorizada;
- débito e crédito possuem o mesmo valor positivo;
- a soma dos saldos da residência não muda;
- uma referência inválida não cria cabeçalho, entrada ou saldo parcial.

## Testes

- `FinancialTransactionTests.TransferRequiresDifferentAccountsAndCreatesEqualOppositeEntries`;
- `FinancialTransactionTests.TransferRejectsSameAccount`;
- `EfLedgerStoreIntegrationTests.TransferMovesValueAtomicallyWithoutChangingConsolidatedBalance`;
- `EfLedgerStoreIntegrationTests.InvalidTransferLeavesNoTransactionEntriesOrPartialBalance`.

Essa implementação mantém o domínio independente da persistência e usa a transação do adaptador de infraestrutura como unidade atômica, coerente com a arquitetura definida para o InOut.
