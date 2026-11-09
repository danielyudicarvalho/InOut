# GOM-86 — Idempotência e controle de concorrência

## Garantias entregues

- A intenção é adquirida atomicamente em `private.idempotency_requests`, no escopo residência + operação + chave.
- Repetições semanticamente idênticas retornam o identificador original com `replayed: true`.
- A reutilização da chave com operação ou payload diferente retorna `idempotency_conflict` e HTTP 409.
- O fingerprint SHA-256 impede que a chave seja reutilizada por outro ator ou payload.
- A restrição única do PostgreSQL é a autoridade contra aquisições concorrentes.
- Criações de conta também usam `Idempotency-Key`; o `account_id` continua sendo uma constraint de identidade independente.
- Uma conta possui no máximo um `opening_balance`, e uma transação no máximo um estorno, independentemente das chaves usadas.
- Mutações, resposta idempotente, auditoria e evento Outbox são confirmados na mesma transação.
- Eventos possuem identidade e versão; consumidores futuros usam Inbox transacional.
- Estornos bloqueiam a transação original durante a alteração de estado.

## Evidência automatizada

- Duas receitas concorrentes com a mesma chave criam exatamente uma transação.
- Uma repetição com valor ou descrição divergente é rejeitada sem alterar novamente o saldo.
- Uma conta com saldo zero aceita replay idêntico e rejeita payload divergente.
- O pipeline reconstrói o banco do zero e valida migrations, RLS, backend, Flutter, Web e Android.
