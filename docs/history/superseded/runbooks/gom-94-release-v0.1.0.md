# GOM-94 — aceite e lançamento v0.1.0

Estado: **lançamento pendente**. Preencher este registro com evidência observada; não criar a tag antes de concluir todos os itens.

## Ambiente e dados conhecidos

Use um ambiente isolado, com duas contas de usuário que sejam membros da mesma residência. Registre a revisão da API, do Flutter e das migrations, o ambiente e os IDs de correlação relevantes. Não registre senhas, tokens, dados financeiros reais ou dumps em texto no repositório.

Crie duas contas BRL, A e B, com saldo inicial zero; categorias compatíveis com receita e despesa. Use valores de teste. Confirme, antes e depois de cada passo, os saldos exibidos no Flutter e o resultado de `GET /api/v1/households/{householdId}/ledger/reconciliation` com o JWT de um membro. Verifique também o isolamento usando outro usuário sem participação: as rotas financeiras da residência devem negar o acesso.

| Passo | Operação pela interface | A | B | Total esperado |
|---|---|---:|---:|---:|
| 0 | Saldos iniciais | R$ 0,00 | R$ 0,00 | R$ 0,00 |
| 1 | Entrada de R$ 100,00 em A | R$ 100,00 | R$ 0,00 | R$ 100,00 |
| 2 | Saída de R$ 25,00 em A | R$ 75,00 | R$ 0,00 | R$ 75,00 |
| 3 | Transferência de R$ 10,00 de A para B | R$ 65,00 | R$ 10,00 | R$ 75,00 |
| 4 | Estorno da saída de R$ 25,00 | R$ 90,00 | R$ 10,00 | R$ 100,00 |
| 5 | Novo lançamento de saída corrigida de R$ 20,00 em A | R$ 70,00 | R$ 10,00 | R$ 80,00 |

Depois do passo 5, confirme que o histórico preserva o original estornado, o estorno com `reversalOf` apontando para o original e o novo lançamento independente. `isConsistent` deve ser verdadeiro em cada passo. Repita a leitura com a segunda conta de usuário; teste com conexão interrompida durante um envio e repita a operação sem duplicá-la. Registre o resultado real e o ID de correlação do erro, se houver.

## Revisão de acessibilidade

- Tema claro e escuro do sistema: contraste, textos, estados de erro, carregamento e vazio em celular e Web.
- Teclado no Web: Tab, Shift+Tab, Enter, Escape e foco visível em entrada, saída, transferência, histórico e diálogo de estorno.
- Leitor de tela (TalkBack e/ou NVDA): rótulos de campos, valores, botões, estado de estorno e confirmação anunciados; ordem de leitura coerente.
- Tamanho de fonte ampliado: formulários roláveis, sem texto cortado nem botões inacessíveis.
- Testar ausência de contas/categorias, histórico vazio e falha de carregamento.

Registre plataforma, versão, usuário de teste, resultado e correções aplicadas. A checagem de widgets ou compilação não substitui essa revisão assistiva.

## Gate de publicação

- [ ] Duas contas de usuário completaram a jornada e a revisão de acessibilidade acima.
- [ ] Saldo conhecido e reconciliação conferidos; bloqueadores corrigidos.
- [ ] GOM-93: primeiro backup real e restauração integral validada em outro projeto Supabase.
- [ ] PRs requeridas incorporadas e escopo v0.1.0 congelado.
- [ ] CI de `main` verde: backend, migrations/RLS, Flutter, Web e Android.
- [ ] Tag anotada `v0.1.0` criada **no commit de `main` verificado**; registrar SHA, data e responsável.

Falha em qualquer item mantém o lançamento pendente. O workflow de backup e a PR #44 continuam pendentes de validação operacional até prova em outro projeto.
