# Moedas de orçamentos e metas

Novos orçamentos e metas têm moeda explícita, normalizada para três letras maiúsculas. Nenhum valor de planejamento é convertido automaticamente.

## Contrato

`POST /api/v1/households/{householdId}/ledger/budgets` exige `currency` junto de categoria, período e limite. A resposta também informa `currency`. Exemplo: `{"categoryId":"…","periodStart":"2026-10-01","periodEnd":"2026-10-31","limitCents":150000,"currency":"BRL"}`.

A identidade do orçamento é residência + categoria + início + fim + moeda. BRL e USD podem coexistir para a mesma categoria e período. Sem `id`, a operação cria/atualiza essa combinação. Com `id`, só atualiza um orçamento com a mesma categoria/período; a moeda já atribuída não pode mudar. A moeda e o ID de resolução integram o fingerprint de idempotência. Chaves antigas de requisições anteriores ao novo contrato não devem ser reutilizadas para comandos diferentes.

O dashboard retorna moeda em cada orçamento/meta. `spentCents` inclui apenas despesas líquidas de estornos da mesma categoria e moeda. Ausência de despesas nessa moeda produz zero, mesmo quando existem gastos em outras moedas.

O domínio de metas exige moeda na criação e na atualização do valor alocado; alocação em outra moeda gera `currency_mismatch`. O progresso existente não é convertido nem recalculado.

## Migração e registros antigos

Aplicar a migration `planning_currencies` antes de publicar o backend atualizado. Ela adiciona moeda, substitui a unicidade de orçamento e valida novas escritas, preservando tabelas, IDs, valores, políticas RLS e autoria. Não atribui BRL, nem deduz moeda a partir das contas atuais.

Registros anteriores permanecem com `currency: null` e o dashboard informa `requiresCurrencySelection: true`. Orçamentos não resolvidos retornam `spentCents: null`, pois um total sem moeda seria ambíguo. Esses valores não devem ser apresentados como BRL, somados ou usados para calcular percentuais. Valores das metas antigas também permanecem sem unidade até confirmação explícita.

Para resolver um orçamento antigo, reenviar seu ID, categoria, período e limite com a moeda confirmada. Para metas, ainda sem API de gestão, a confirmação deve ser feita por uma operação administrativa restrita à residência e ao ID. Uma moeda atribuída é imutável: uma intenção em outra moeda exige outro registro, sem reinterpretar valores antigos. A restrição também vale para escritas diretas no banco.

Consulta de inventário antes da migração de dados manual: `select id, household_id from public.budgets where currency is null;` e a equivalente para `public.goals`. Não preencher em massa com base na moeda de uma conta ou no país da residência.

## Verificação

Testes de domínio cobrem validação e rejeição de alocação em outra moeda. O teste do dashboard mistura BRL/USD, estorno, moeda sem despesas e registros antigos não resolvidos. O teste da camada de aplicação verifica normalização e fingerprint. O teste de integração usa a migration real e verifica coexistência, replay e conflito entre moedas. O pgTAP cobre invariantes no banco. Uma execução local da migration com PostgreSQL embarcado verifica também preservação dos registros anteriores e execução dos gatilhos sob papel sem privilégios de proprietário.

A migration não é aplicada automaticamente a um projeto hospedado por este trabalho. O deploy deve coordenar a mudança de esquema e o novo contrato da API.
