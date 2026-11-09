# Conflito ou registro desatualizado

Implementado em 2026-11-02 a partir de `image(20261102-033956).png`.

## Comportamento e integração

Web: `/lancamento?household=<id>&transaction=<uuid>&period=2026-11`.
Mobile: a mesma rota em Expo Router. O histórico nos dois clientes abre o
registro por seu identificador real, dentro da sessão e residência autorizadas.

A branch UI atual (`a21866c`) não continha o detalhe nem a correção de
classificação das implementações anteriores. Foram recuperados apenas os
contratos, a idempotência e o carregamento necessários a esta funcionalidade,
preservando os seletores atuais de novo registro. O cliente não usa exemplos
financeiros nem dados de demonstração em produção.

1. A correção carrega a categoria, fonte opcional e descrição reais. Valor,
   contas e data permanecem imutáveis. Subcategorias mantêm seu identificador.
2. Ao confirmar, o corpo e uma chave UUID são persistidos no dispositivo antes
   do PATCH. O corpo inclui `expectedState` com status, categoria, fonte e
   descrição observados no carregamento do editor.
3. O backend adquire a identidade da operação e depois o bloqueio da transação.
   O domínio compara o estado esperado com o registro atual antes de qualquer
   modificação. Divergência gera HTTP 409 com `code: transaction_changed`, e a
   transação inteira é revertida. Uma tentativa já concluída é reproduzida antes
   dessa verificação, sem reaplicar alterações sobre uma versão posterior.
4. Apenas esse código explícito abre o aviso “Este lançamento foi atualizado”
   e a mensagem de que nenhuma alteração desta tentativa foi salva. Um registro
   já estornado encontrado antes do envio também abre o aviso sem emitir PATCH.
5. Fechar o aviso não reabilita alterações na versão antiga. “Recarregar dados”
   executa somente GETs, descarta os dados acionáveis anteriores e consulta o
   identificador exato, sem restringir pelo período da tela anterior.
6. Somente após a leitura bem-sucedida aparece “Dados atualizados”. Falha,
   timeout, perda de acesso ou registro inexistente não restauram dados antigos.
   Respostas atrasadas e requisições de telas desmontadas são ignoradas.
7. Se o registro estiver estornado, a ação de correção desaparece. O filtro
   `history?reversalOf=<uuid>` fornece o vínculo real de “Ver estorno”. O detalhe
   do estorno permite voltar ao lançamento original. “Voltar ao histórico” mantém
   a residência e o período selecionados.

Outros HTTP 409, respostas inválidas, falhas de rede ou timeout **não comprovam
rejeição**. A interface mantém o estado de operação sem confirmação e permite
consultar a mesma tentativa, preservando corpo, precondição e chave. Não há
reenvio automático ao abrir, recarregar ou fechar a tela. Rejeições definitivas
são marcadas antes da limpeza do armazenamento; se ela falhar, a recuperação
remove a tentativa rejeitada antes de permitir um novo envio.

A autoria apresentada é o UUID `createdBy` e a data `postedAt` disponível no
contrato. Não foram inventados nomes, horários de edição ou eventos de auditoria
que o backend não fornece. O horário exibido usa o fuso do dispositivo.

## Camadas e compatibilidade

A regra de comparação fica em `FinancialTransaction` e no objeto de valor
`TransactionClassificationSnapshot`. A aplicação monta a identidade da operação;
a infraestrutura controla bloqueio, transação, auditoria e replay. O módulo
`packages/finance` contém os estados compartilhados; componentes web/native
tratam apresentação e interação. Essa separação segue a Dependency Rule de
Clean Architecture, capítulo 22, e a proteção contra lost updates com verificação
sob bloqueio discutida em DDIA, capítulo 7.

Não há migração de banco. `correct_classification` usa a operação de idempotência
existente e seu armazenamento textual. `expectedState` e o cabeçalho de
idempotência são opcionais para compatibilidade com clientes anteriores; os
novos clientes sempre enviam ambos. Clientes antigos sem a precondição mantêm
seu comportamento anterior. Publicar backend e clientes em conjunto é necessário
para disponibilizar a proteção de concorrência aos novos clientes.

Os erros de tipagem preexistentes nos seletores de novo registro foram corrigidos:
subcategoria usa o `categoryId` canônico; o catálogo expõe `parentId` e tipo de
conta; criação de categoria/fonte usa os endpoints e identificadores reais.

## Arte

Gerada com a ferramenta integrada de geração de imagens e preservada com alpha:

- `frontend/public/images/pipo-conflict.webp`
- `mobile/assets/pipo-conflict.webp`

Prompt: “Use case: illustration-story. Asset type: transparent illustration for
Ninho household finance conflict dialog on web and mobile. Cozy watercolor
children's-book game UI illustration. A cute round fluffy yellow baby bird Pipo,
tiny green leaf tuft on head, orange beak, rust-orange scarf, standing beside two
cream ledger pages on small wooden clipboards. Left page older faded gray lines,
right page fresh sage green lines; a small pair of curved green refresh arrows
between pages. Gentle sage leafy sprigs frame the low wide composition. Friendly
reassuring expression. Soft cream, honey yellow, forest and sage green palette,
handpainted watercolor texture, clean silhouette. Genuine transparent background.
No letters, numbers, words, logos, watermark, UI frames or buttons. Wide compact
composition all elements visible with generous transparent padding.”

O PNG gerado foi apenas reduzido e convertido a WebP; o conteúdo da ilustração
não foi editado por script.

## Validação

- Web: lint, tipagem, 99 testes Node e build Next de produção (35 rotas).
- Mobile: lint, tipagem e 92 testes Node. Sem exportação ou build nativo nesta etapa.
- Regressões: código explícito versus 409 ambíguo, bloqueio de reenvio, limpeza
  durável de rejeição, replay exato após nova consulta, leitura autenticada por
  UUID, ligação ao estorno, falha/timeout e respostas atrasadas.
- Adicionados testes .NET de domínio, resposta HTTP e integração PostgreSQL:
  correção concorrente, rollback sem perda de saldo, replay após edição posterior
  e consulta de estorno pelo original. **Não executados neste ambiente**, que não
  possui SDK .NET nem Docker.
- A arte foi inspecionada. Aceitação visual no navegador e em aparelho permanece
  pendente: não havia Chromium local, seu download falhou e o navegador remoto
  não conseguiu alcançar o servidor local (`ERR_CONNECTION_REFUSED`). Nenhuma
  operação financeira real foi executada durante a validação.
