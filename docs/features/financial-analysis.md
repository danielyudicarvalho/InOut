# Análises e revisão financeira

A área `/analises`, na web e no Expo Router, reúne sete análises. O dashboard oferece acesso direto preservando residência, período e moeda.

| Análise                               | Rota                       |
| ------------------------------------- | -------------------------- |
| Visão geral                           | `/analises/visao-geral`    |
| Comparação                            | `/analises/comparar`       |
| Despesas por categoria e subcategoria | `/resumo-categorias`       |
| Receitas por fonte                    | `/fontes-renda`            |
| Movimentação por conta                | `/analises/contas`         |
| Evolução                              | `/analises/evolucao`       |
| Revisão mensal                        | `/analises/revisao-mensal` |

## Contrato e regras

`GET /api/v1/households/{householdId}/ledger/analysis?currency=BRL&from=2026-10-01&to=2026-10-31`

Exige autenticação e membership antes da leitura. O período pode ter até 731 dias. Cada resposta trata uma moeda, conserva contas arquivadas, informa conciliação e contém fatos atuais/anteriores, diferenças absolutas e percentuais, série mensal, movimentação por conta e mudanças por categoria/fonte.

Um mês completo compara com o mês anterior e apresenta seis meses na evolução. Um intervalo personalizado compara com o intervalo imediatamente anterior de igual duração e divide a evolução pelos meses interceptados, preservando as datas parciais. Base anterior zero com mudança produz percentual nulo; zero contra zero produz zero. Bases negativas usam seu valor absoluto no denominador.

A consulta lê o intervalo necessário uma vez pelo leitor histórico. Receita, despesa e resultado são líquidos de estornos e excluem transferências e saldos iniciais. Créditos, débitos e variação da conta seguem a direção real dos lançamentos; incluem transferências, seus estornos e eventuais saldos iniciais. Transferências recebidas/enviadas são discriminadas separadamente. O dashboard e os detalhamentos também preservam contas arquivadas e usam a mesma direção real para movimentação de conta.

A revisão apresenta os dez maiores deltas absolutos por categoria ou fonte, com acesso aos registros. Categorias são valores diretos, sem somar as subcategorias novamente. A revisão descreve mudanças sem atribuir causas ou emitir recomendações. O acesso de fonte não definida encaminha ao resumo de fontes.

## Interface

Filtros de residência, período e moeda; estados de carregamento, ausência de contas, erro/repetição e divergência de conciliação. As rotas participam do bloqueio de acesso removido. Tabelas apresentam os valores com sinal, além dos gráficos; padrões/bordas distinguem valores negativos.

Artes: `pipo-analysis.webp` (Pipo revisando o livro com lupa) e `pipo-analysis-growth.webp` (Pipo comparando canteiros). Geradas a partir de `pipo-catalog.png` como referência de identidade e aquarela, com transparência e cópias otimizadas para web/mobile. Prompts: Pipo amarelo com folhas verdes e cachecol terracota, mesa/livro/lupa/calendário sem texto para revisão; dois canteiros em diferentes estágios para comparação/evolução. Não representam dados financeiros.

## Validação

Testes do contrato cliente e das regras de consulta cobrem autorização, moedas, percentuais sem base, períodos personalizados e composição de transferências. Navegação e layout web foram exercitados em desktop e largura móvel com respostas controladas da API. Testes PostgreSQL com Testcontainers exigem Docker; execução contra um backend publicado e validação em dispositivo nativo são etapas distintas.
