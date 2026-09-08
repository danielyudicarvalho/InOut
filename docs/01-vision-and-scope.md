# Visão, escopo e requisitos

## Visão

O InOut é o registro financeiro compartilhado de uma residência. Ele deve responder, sem planilhas paralelas: quanto temos, quanto entrou e saiu, em que gastamos, se o orçamento está sob controle, quanto avançamos nas metas e quem lançou ou corrigiu cada informação.

## Usuários e contexto

- Dois usuários conhecidos, pertencentes à mesma casa.
- Uso frequente em celular e eventual uso em desktop.
- Dados pessoais e financeiros privados.
- Volume baixo, mas necessidade alta de correção e confiança.
- Projeto inicial com duração de sete dias.

## Resultado esperado do MVP

Ao final da semana, ambos conseguem entrar na mesma casa, registrar e consultar movimentações, classificar gastos, corrigir erros preservando o histórico e acompanhar o mês em um painel simples.

## Jornadas essenciais

1. Criar ou acessar a casa compartilhada.
2. Criar contas como carteira, conta corrente e poupança.
3. Registrar receita, despesa ou transferência.
4. Definir categoria e subcategoria.
5. Consultar histórico com filtros.
6. Corrigir um erro por estorno e, quando necessário, relançamento.
7. Configurar orçamento mensal e meta de economia.
8. Ver saldo, resultado mensal e gastos por categoria.
9. Exportar lançamentos em CSV.

## Requisitos funcionais

### Casa e acesso

- Uma casa tem dois ou mais membros, embora o primeiro uso seja de um casal.
- Cada membro autentica-se individualmente.
- Ambos veem os mesmos dados da casa.
- Toda alteração registra autor e data.

### Contas e movimentos

- Cadastrar, editar e arquivar contas.
- Registrar receitas, despesas e transferências.
- Usar valores monetários em centavos, nunca ponto flutuante.
- Informar data de competência, descrição, conta, categoria e observação opcional.
- Filtrar por período, tipo, conta, categoria e membro.
- Não excluir definitivamente um lançamento contabilizado.

### Organização e planejamento

- Categorias de receita e despesa.
- Subcategorias vinculadas a uma categoria.
- Orçamento por categoria e mês.
- Meta de economia com valor-alvo e prazo.
- Projetos financeiros simples, como viagem ou reserva.

### Painel

- Saldo por conta e saldo consolidado.
- Total de receitas, despesas e resultado do mês.
- Distribuição de despesas por categoria.
- Progresso dos orçamentos e metas.
- Indicadores calculados a partir do mesmo conjunto de lançamentos.

## Requisitos arquiteturais prioritários

| Característica | Decisão mensurável para o MVP |
|---|---|
| Integridade | Transferências e estornos são atômicos; nenhum saldo parcial. |
| Segurança | Um usuário só acessa dados das casas das quais é membro. |
| Auditabilidade | Movimentos contabilizados são imutáveis; correções apontam para o original. |
| Recuperabilidade | Backup automático e exportação CSV testada. |
| Usabilidade | Registrar uma despesa comum em até 30 segundos. |
| Performance | Consultas do mês devem parecer imediatas no uso doméstico. |
| Manutenibilidade | Regra de negócio não depende de tela, framework ou SDK do banco. |
| Portabilidade | Ambiente local reproduzível e configuração por variáveis de ambiente. |

## Não objetivos da primeira semana

Integração bancária, conciliação avançada, cartões/faturas complexos, OCR, investimentos com cotação, IA, multi-moeda, contabilidade fiscal, múltiplas casas, microserviços, filas, CQRS e event sourcing completo.

## Critérios de aceite do MVP

- As nove jornadas essenciais funcionam para dois usuários.
- Saldos e indicadores reconciliam com os movimentos.
- Transferência não altera o patrimônio consolidado.
- Estorno anula o efeito do original e mantém ambos visíveis.
- Acesso cruzado entre casas é bloqueado por teste.
- Pipeline executa análise estática e testes.
- Há procedimento documentado de backup, restauração e exportação.
- Nenhum erro crítico conhecido permanece aberto.