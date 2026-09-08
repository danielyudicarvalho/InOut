# Plano de entrega em sete dias

## Definição de pronto

Uma tarefa está pronta quando o fluxo funciona, regras centrais têm testes, estados de erro são tratados, documentação afetada foi atualizada e o pipeline está verde.

## Dia 1 - Fundamentos e caminho executável

- Confirmar stack e registrar ADR.
- Inicializar projeto, ambientes e configuração.
- Definir módulos e convenções.
- Configurar lint, testes e CI.
- Criar esquema inicial de casa, membros e contas.
- Entregar autenticação e acesso à casa compartilhada.

**Saída:** ambos entram no sistema e veem a mesma casa.

## Dia 2 - Ledger essencial

- Implementar dinheiro em centavos.
- Criar movimentos, entradas e transações atômicas.
- Implementar receita e despesa.
- Exibir contas, saldo e histórico.
- Testar balanceamento, propriedade e valores inválidos.

**Saída:** registrar entradas e saídas com saldo correto.

## Dia 3 - Transferência e correções

- Implementar transferência entre contas.
- Implementar estorno e relançamento.
- Adicionar idempotência.
- Tratar concorrência e duplo clique.
- Criar testes de reconciliação.

**Saída:** nenhuma correção exige apagar ou editar histórico contabilizado.

## Dia 4 - Classificação e planejamento

- Criar categorias e subcategorias customizáveis.
- Adicionar filtros.
- Implementar orçamento mensal.
- Implementar meta de economia e projeto financeiro simples.

**Saída:** movimentos organizados e planejamento básico disponível.

## Dia 5 - Painel e exportação

- Saldo por conta e consolidado.
- Receitas, despesas e resultado do mês.
- Gastos por categoria.
- Progresso de orçamento e meta.
- Exportação CSV.

**Saída:** o casal entende a situação do mês sem cálculo manual.

## Dia 6 - Segurança, resiliência e acabamento

- Testar isolamento entre casas.
- Revisar autorização e exposição de dados.
- Implementar logs estruturados e captura de erros.
- Configurar backup e testar restauração.
- Melhorar acessibilidade, estados vazios e mensagens de erro.
- Executar testes end-to-end das jornadas críticas.

**Saída:** candidato de lançamento confiável.

## Dia 7 - Validação real e lançamento

- Cadastrar contas e categorias reais.
- Fazer sessão de uso conjunta.
- Reconciliar amostra com saldos conhecidos.
- Corrigir somente bloqueadores.
- Congelar escopo.
- Criar tag `v0.1.0` e publicar.
- Registrar débitos e backlog pós-MVP.

**Saída:** versão doméstica em produção e utilizada pelos dois.

## Ordem de corte se o prazo apertar

1. Preservar casa, contas, receitas, despesas, transferências e estornos.
2. Preservar segurança, integridade, backup e exportação.
3. Simplificar metas e projetos.
4. Reduzir o painel a números e uma distribuição por categoria.
5. Adiar refinamentos visuais e filtros secundários.

Nunca cortar isolamento de dados, atomicidade financeira, auditabilidade ou recuperação.

## Riscos da semana

| Risco | Resposta |
|---|---|
| Escopo cresce durante a execução | Congelamento diário; ideias novas vão ao backlog. |
| Stack ainda indefinida | Decidir no Dia 1 com ADR curto e reversível. |
| Saldo diverge | Ledger como fonte da verdade e teste de reconciliação. |
| Duplo lançamento | Idempotência e bloqueio de reenvio na UI. |
| Um usuário vê dados indevidos | Testes negativos de autorização e proteção no banco. |
| Falha ou perda de banco | Backup automático, restauração ensaiada e CSV. |
| UI consome todo o prazo | Componentes simples; priorizar jornadas completas. |