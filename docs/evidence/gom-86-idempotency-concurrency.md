# GOM-86 — Idempotência e controle de concorrência

## Garantias entregues

- A chave de idempotência é serializada por residência com advisory lock transacional.
- Repetições semanticamente idênticas retornam o identificador original com `replayed: true`.
- A reutilização da chave com operação ou payload diferente retorna `idempotency_conflict` e HTTP 409.
- A restrição única do PostgreSQL permanece como defesa adicional contra duplicação.
- Criações de conta, inclusive com saldo inicial zero, persistem a chave e podem ser repetidas com segurança.
- Estornos bloqueiam a transação original durante a alteração de estado.

## Evidência automatizada

- Duas receitas concorrentes com a mesma chave criam exatamente uma transação.
- Uma repetição com valor ou descrição divergente é rejeitada sem alterar novamente o saldo.
- Uma conta com saldo zero aceita replay idêntico e rejeita payload divergente.
- O pipeline reconstrói o banco do zero e valida migrations, RLS, backend, Flutter, Web e Android.
