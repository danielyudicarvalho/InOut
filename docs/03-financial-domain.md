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

Representa receita, despesa, transferência ou estorno. É a raiz das invariantes financeiras e possui uma ou mais pernas contábeis.

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

- **Saldo da conta** = saldo inicial explícito + soma das entradas contabilizadas.
- **Patrimônio consolidado** = soma dos saldos das contas ativas incluídas.
- **Resultado do período** = receitas externas - despesas externas.
- **Transferências internas** não alteram resultado nem patrimônio consolidado.
- **Uso do orçamento** = despesas válidas da categoria / limite do período.
- **Progresso da meta** = valor alocado / valor-alvo.

## Regras de concorrência

- Gravações financeiras usam transação de banco.
- Operações aceitam chave de idempotência para evitar duplo envio.
- A versão do registro ou constraint impede estorno duplo.
- O cliente não calcula o saldo final como fonte de verdade.
- Respostas a repetição idempotente retornam o resultado original.

## Auditoria e privacidade

Registrar: usuário, casa, ação, entidade, identificador, instante e resultado. Não registrar senha, token, conteúdo integral de observações ou outros dados sensíveis. A trilha operacional complementa, mas não substitui, a imutabilidade dos movimentos.