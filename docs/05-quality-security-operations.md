# Qualidade, segurança e operação

## Estratégia de testes

### Unitários

Cobrem regras puras:

- dinheiro e arredondamento;
- balanceamento;
- receita, despesa e transferência;
- estorno;
- categoria/subcategoria;
- orçamento e metas.

### Integração

Cobrem banco e adaptadores:

- constraints e transações;
- isolamento por casa;
- persistência do ledger;
- idempotência;
- consultas do painel;
- exportação.

### End-to-end

Três jornadas são obrigatórias:

1. entrar, registrar despesa e vê-la no painel;
2. transferir entre contas sem alterar patrimônio;
3. estornar um erro e registrar o valor correto.

A pirâmide deve favorecer testes unitários rápidos, com poucos testes E2E de alto valor.

## Pipeline mínimo

Em cada mudança:

1. instalar dependências com lockfile;
2. verificar formatação e análise estática;
3. executar testes unitários;
4. executar testes de integração;
5. construir artefato de produção;
6. bloquear merge em qualquer falha.

O deploy inicial pode ser manual e documentado; deve usar o mesmo artefato validado pelo pipeline.

## Segurança

- Autenticação individual.
- Autorização sempre baseada na associação do usuário à casa.
- Defesa em profundidade no banco quando disponível.
- Menor privilégio para credenciais e papéis.
- Segredos apenas em variáveis protegidas; nunca no repositório.
- TLS em trânsito e criptografia do provedor em repouso.
- Dependências fixadas e atualizadas conscientemente.
- Mensagens de erro não expõem stack, SQL ou dados pessoais.
- Sessões revogáveis e expiração apropriada.
- O repositório é público: nenhuma informação financeira real, endereço, e-mail privado ou configuração secreta pode ser commitida.

## Privacidade

Coletar apenas o necessário ao funcionamento. Permitir exportar os dados. Definir procedimento de exclusão da casa, com confirmação forte e período de recuperação quando tecnicamente viável. Logs não devem conter descrições financeiras completas.

## Observabilidade proporcional

- Logs estruturados com nível, evento, request/correlation ID e resultado.
- Captura centralizada de exceções.
- Health check simples.
- Métricas: erros, latência, falhas de login e falhas de gravação.
- Alertas apenas para indisponibilidade e erros persistentes relevantes.
- Sem infraestrutura distribuída para dois usuários.

## Backup e recuperação

- Backup automático diário do banco.
- Retenção mínima inicial de sete dias.
- Exportação CSV manual disponível.
- Teste de restauração antes do lançamento.
- RPO inicial: até 24 horas.
- RTO inicial: até 4 horas.
- Procedimento registra responsável, local do backup e passos de validação.

## Checklist de lançamento

- [ ] Ambos os usuários acessam somente a casa correta.
- [ ] Saldos reconciliam com uma amostra conhecida.
- [ ] Transferências somam zero no consolidado.
- [ ] Estorno neutraliza exatamente o original.
- [ ] Duplo envio não duplica movimento.
- [ ] Pipeline está verde.
- [ ] Segredos não aparecem no repositório ou build.
- [ ] Backup foi criado e restaurado em teste.
- [ ] CSV abre corretamente e contém os campos esperados.
- [ ] Erros críticos aparecem no monitoramento sem dados sensíveis.
- [ ] Termos financeiros são usados de forma consistente.
- [ ] Débitos conhecidos foram registrados.

## Resposta a incidentes doméstica

1. Parar novos lançamentos se houver risco de corrupção.
2. Registrar horário, ação e sintomas.
3. Preservar logs e exportar dados atuais.
4. Reproduzir em ambiente separado.
5. Corrigir com teste de regressão.
6. Restaurar ou reconciliar quando necessário.
7. Documentar causa e prevenção em ADR ou issue.

## Revisão pós-semana

Avaliar uso real após duas semanas antes de ampliar o escopo. Métricas úteis: dias com uso, tempo médio de lançamento, divergências encontradas, correções realizadas e categorias sem classificação.