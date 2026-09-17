# ADR-006 - Idempotência e mensageria confiável

## Status

Aceito.

## Contexto

Retries são inevitáveis em chamadas de rede e entregas de mensagens. Uma resposta
pode ser perdida depois do commit, mensagens podem ser entregues mais de uma vez
e intenções diferentes podem disputar os mesmos agregados. Idempotência não deve
ser confundida com identidade da entidade, concorrência ou invariantes do domínio.

## Decisão

### Domain

- Mantém identidades, estados e invariantes financeiras.
- Não conhece headers HTTP, fingerprints, respostas serializadas ou tabelas de
  deduplicação.
- Regras exclusivas permanecem independentes da chave: uma abertura por conta,
  um estorno por transação e referências válidas dentro da residência.

### Application

- `IdempotencyRequest` representa a intenção: tenant, ator, operação, chave e
  fingerprint SHA-256 do payload semântico canonicalizado.
- `IdempotencyOperation` define namespaces estáveis para os casos de uso.
- Mesmo tenant/operação/chave com fingerprint diferente é conflito.
- A chave é transportada por `Idempotency-Key`; DTOs de negócio não carregam o
  detalhe de transporte.

### Infrastructure

- `private.idempotency_requests` implementa aquisição atômica, lease, estados,
  resultado semântico, referência ao recurso e retenção de 90 dias.
- A constraint `(tenant_id, operation, idempotency_key)` é a autoridade contra
  corrida; não existe fluxo `SELECT` seguido de `INSERT` desprotegido.
- A aquisição, mutação, auditoria, Outbox e conclusão compartilham uma transação.
- `processing`, `completed`, `failed_retryable` e `failed_final` modelam falhas e
  retomada. Operações síncronas atômicas fazem rollback integral em falhas; leases
  permitem recuperar execuções persistidas abandonadas por futuros workflows.
- Métricas `idempotency.started`, `replayed`, `conflicts`, `in_progress`,
  `reclaimed` e `failed` tornam replay e abandono observáveis.

### API

- Operações mutáveis idempotentes recebem `Idempotency-Key` com UUID não vazio.
- Primeiro sucesso retorna `201`; replay concluído retorna `200` com o mesmo
  resultado semântico e `replayed: true`.
- Reuso incompatível ou operação ainda em andamento retorna `409` com código
  estável.

### Concorrência e ordenação

- Contas afetadas por uma transação são bloqueadas em ordem crescente para
  serializar intenções diferentes e evitar deadlocks.
- Estorno bloqueia a transação original.
- Criação bloqueia a identidade natural da conta, independentemente da chave.
- Outbox usa `event_id` único e `(aggregate_type, aggregate_id,
  aggregate_version)` único para preservar a ordem por agregado.

### Autorização

- Tabelas de confiabilidade ficam no schema `private`, sem acesso de `anon` ou
  `authenticated`.
- O runtime dedicado acessa somente linhas de residências das quais o sujeito é
  membro. Replays exigem o mesmo ator da intenção original.
- A autorização da rota é executada antes do caso de uso e RLS permanece como
  defesa em profundidade.

### Mensageria

- Eventos são persistidos em Outbox na mesma transação da mutação.
- Consumidores usam `IInboxMessageProcessor`, que registra `(consumer,
  message_id)` e os efeitos locais na mesma transação.
- Mesmo ID com outro tenant ou fingerprint é conflito; mensagem processada é
  reconhecida sem repetir efeitos.
- Efeitos externos devem receber chave própria derivada da etapa, e não reutilizar
  indiscriminadamente a chave do comando raiz.

### Evolução e migração

- Novos casos de uso aderem ao protocolo pela aplicação e pelo coordenador; não
  adicionam colunas de idempotência às entidades do domínio.
- Chaves históricas de transações viram tombstones com retenção. Como não é
  possível reconstruir seu payload canônico, retries legados falham fechados em
  vez de criarem um segundo efeito.
- Um relay de Outbox deve publicar em ordem por agregado e marcar o evento apenas
  depois do aceite do destino. A identidade do evento é a chave do envio.
- Workers sem identidade de usuário precisam de um papel de serviço dedicado,
  com privilégio mínimo e políticas separadas das rotas autenticadas.

## Checklist de aceitação

- [x] A chave representa uma intenção lógica.
- [x] A mesma chave é reutilizada apenas nos retries.
- [x] Uma nova intenção recebe nova chave por contrato do cliente.
- [x] O escopo inclui tenant e operação.
- [x] Existe fingerprint do payload semântico.
- [x] Mesmo key com payload ou ator diferente gera conflito.
- [x] Existe unique constraint no banco.
- [x] A aquisição da chave é atômica.
- [x] Chave, mutação, auditoria e evento são confirmados juntos.
- [x] Requisições concorrentes são serializadas por constraint e locks ordenados.
- [x] O replay devolve resultado semanticamente equivalente.
- [x] Estados intermediários, lease e retomada estão modelados.
- [x] A retenção cobre retries tardios conforme política inicial de 90 dias.
- [x] Eventos possuem ID próprio e versão do agregado.
- [x] Consumidores possuem Inbox transacional reutilizável.
- [x] Efeitos externos exigem chave própria por etapa.
- [x] Existem métricas de replay, conflito, execução pendente e recuperação.
- [x] Invariantes do domínio permanecem protegidas separadamente.

## Consequências

Há custo adicional de armazenamento e coordenação, mas novas operações podem
adotar o mesmo modelo sem adicionar `idempotency_key` às entidades de negócio.
Limpeza por expiração só pode remover registros depois da janela de retry definida
para o caso de uso; operações reguladas podem exigir retenção maior.
