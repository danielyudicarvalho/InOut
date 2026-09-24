# Domínio financeiro e integridade

## Linguagem comum

- **Casa**: unidade de propriedade e compartilhamento dos dados.
- **Membro**: usuário autorizado a operar em uma casa.
- **Conta**: local lógico que mantém recursos, como carteira ou banco.
- **Movimento**: fato financeiro que altera uma ou duas contas.
- **Receita**: entrada externa de valor em uma conta.
- **Despesa**: saída de valor de uma conta.
- **Transferência**: saída de uma conta e entrada equivalente em outra.
- **Estorno**: movimento inverso que neutraliza um movimento anterior.
- **Relançamento**: novo movimento correto após um estorno.
- **Categoria/Subcategoria**: classificação hierárquica do movimento.
- **Orçamento**: limite planejado de despesa por período e categoria.
- **Meta**: valor-alvo acumulado para uma finalidade.

## Agregados e responsabilidades

### Household

Mantém membros e garante que ao menos um responsável permaneça. No MVP, ambos podem operar os dados; mudanças de membros exigem privilégio de responsável.

### Account

Define nome, tipo, moeda, estado ativo/arquivado e saldo inicial registrado como movimento explícito.

### Transaction

Representa saldo inicial, receita, despesa, transferência ou estorno. É a raiz das invariantes financeiras e possui uma ou mais pernas contábeis.

### Budget e Goal

Mantêm planejamento, sem reescrever fatos do ledger. Indicadores são derivados dos movimentos válidos do período.

## Modelo mínimo sugerido

- `households`
- `household_members`
- `accounts`
- `categories`
- `transactions`
- `entries`
- `budgets`
- `goals`
- `audit_events`

Uma transação contém entradas contábeis. Para receita ou despesa, o MVP pode usar uma conta de contrapartida lógica. Para transferência, duas entradas opostas garantem soma zero.

## Invariantes

1. Todo valor é inteiro, positivo e expresso em centavos; o sentido está no tipo da entrada.
2. Toda transação pertence a uma única casa.
3. Todas as contas e categorias referenciadas pertencem à mesma casa.
4. Entradas de uma transação balanceiam em soma zero.
5. Transferência exige contas distintas e mesma moeda no MVP.
6. Movimento contabilizado é imutável.
7. Um estorno referencia um movimento contabilizado e não estornado.
8. O valor e as pernas do estorno são exatamente inversos ao original.
9. Uma categoria de despesa não classifica receita e vice-versa.
10. Subcategoria pertence à categoria informada.
11. Contas ou categorias referenciadas não são apagadas; são arquivadas.
12. Datas, autor e instante de criação são armazenados de forma inequívoca.

## Estados da transação

- **draft**: opcional durante a edição; não afeta saldos.
- **posted**: contabilizada e imutável.
- **reversed**: original neutralizado por um estorno.
- **voided**: permitido somente para rascunho nunca contabilizado.

Para a primeira semana, a interface pode criar diretamente em `posted`, reduzindo complexidade.

## Correção de erros

Exemplo: despesa de R$ 150 registrada como R$ 510.

1. Criar estorno de R$ 510 ligado ao movimento original.
2. Marcar o original como revertido sem alterá-lo.
3. Criar nova despesa de R$ 150.
4. Opcionalmente ligar o novo movimento ao fluxo de correção.
5. Mostrar os três registros no histórico com relações claras.

## Fórmulas canônicas

- **Saldo da conta** = soma das entradas contabilizadas, incluindo o movimento explícito `opening_balance`.
- **Patrimônio consolidado** = soma dos saldos das contas ativas incluídas.
- **Resultado do período** = receitas externas - despesas externas.
- **Transferências internas** não alteram resultado nem patrimônio consolidado.
- **Uso do orçamento** = despesas válidas da categoria / limite do período.
- **Progresso da meta** = valor alocado / valor-alvo.

## Projeção mensal do painel

O painel é uma projeção de leitura do mesmo ledger usado pelo histórico e pelos
saldos, nunca uma segunda fonte de verdade. Saldos consideram movimentos até o
fim do período consultado. Receitas, despesas e distribuição por categoria
consideram somente o intervalo mensal; transferências internas são excluídas do
resultado. Um estorno aplica, na data em que ocorreu, o sinal inverso da natureza
do movimento original. Totais consolidados são agrupados por moeda para impedir
somas monetariamente inválidas.

Orçamentos mensais e metas são lidos do módulo Planning. O painel apenas projeta o uso e
o progresso; não altera limites nem alocações. A resposta também expõe o estado
de reconciliação entre transações contabilizadas e transações que possuem
entradas no ledger.

Responsabilidades da projeção:

- **Domain**: representa o período mensal e calcula totais por moeda/categoria,
  excluindo `transfer` e `opening_balance` do resultado e aplicando ao estorno a
  natureza e o sinal inverso do movimento original.
- **Application**: valida o período, autoriza `actorUserId` na residência,
  coordena a leitura e monta o DTO do painel.
- **Infrastructure**: estabelece o ator na transação PostgreSQL, deixa a RLS
  filtrar por residência e retorna snapshots de contas, movimentos, categorias,
  orçamentos, metas e reconciliação; não decide regras financeiras.

A autorização é deliberadamente redundante: a policy HTTP bloqueia cedo, o caso
de uso impede uso indevido por outros adaptadores e a RLS protege o banco contra
consultas acidentais fora da residência.

## Regras de concorrência

- Gravações financeiras usam transação de banco.
- Comandos mutáveis recebem uma identidade de intenção pelo header `Idempotency-Key`; Application calcula o fingerprint e Infrastructure persiste replay e resultado sem contaminar as entidades do domínio.
- A versão do registro ou constraint impede estorno duplo.
- O cliente não calcula o saldo final como fonte de verdade.
- Respostas a repetição idempotente retornam o resultado original.

## Auditoria e privacidade

Registrar: usuário, casa, ação, entidade, identificador, instante e resultado. Não registrar senha, token, conteúdo integral de observações ou outros dados sensíveis. A trilha operacional complementa, mas não substitui, a imutabilidade dos movimentos.

## Limites entre camadas

- **Domain** mantém as invariantes independentes de tecnologia: abertura e
  arquivamento de conta, saldo inicial explícito, referências pertencentes à
  residência, conta/categoria ativa, moeda e fluxo compatíveis e elegibilidade
  para estorno.
- **Application** expressa a intenção dos casos de uso, cria os objetos do
  domínio, limita entradas operacionais como paginação e chama as portas de
  persistência.
- **Infrastructure** carrega os dados exigidos pelas regras, converte registros
  EF para snapshots/objetos do domínio e cuida de transações PostgreSQL, locks,
  idempotência persistida, contexto RLS e consultas; não contém decisões de
  classificação ou consolidação financeira.

Consultas de saldo continuam agregadas no PostgreSQL por eficiência. Isso não
transforma a fórmula do saldo em regra de infraestrutura: a consulta apenas
materializa a projeção definida pelo domínio, somando créditos e subtraindo
débitos contabilizados.
