# GOM-101: corte dos caminhos legados

## Resultado esperado

O Flutter usa Supabase somente para autenticação e envia o access token à API.
Toda leitura ou escrita de negócio passa pela API ASP.NET. Os papéis `anon` e
`authenticated` não possuem privilégios sobre as tabelas de negócio nem
execução nas três RPCs legadas de residência.

## Gates obrigatórios

1. Publicar a API a partir da revisão aprovada e validar `/health/ready`.
2. Publicar o Flutter sem `USE_LEGACY_HOUSEHOLD_RPC` e com `API_BASE_URL`.
3. Confirmar nos logs estruturados, por correlation ID, sucesso nos fluxos de
   listar/criar residência, criar/aceitar convite, lançar receita/despesa,
   transferir, estornar, consultar saldos e reconciliar.
4. Confirmar ausência de chamadas ao Data API/RPC nos clientes suportados.
5. Executar a reconciliação do ledger para cada residência e exigir `isBalanced`.
6. Fazer backup lógico e registrar a revisão da aplicação e da migration.
7. Aplicar `20260915033027_cut_over_legacy_client_paths.sql` primeiro em ambiente
   de ensaio, executar os smoke tests e somente então repetir em produção.

Se qualquer gate falhar, o corte não deve prosseguir.

## Verificação pós-corte

- `anon` e `authenticated` recebem `permission denied` ao ler ou escrever
  tabelas de negócio.
- `authenticated` recebe `permission denied` ao executar cada RPC legada.
- `inout_api_runtime`, com `request.jwt.claim.sub` transacional, acessa somente
  linhas da residência do usuário.
- Idempotência, estorno e reconciliação continuam verdes pela API.
- Nenhum log contém JWT, código de convite ou descrição financeira completa.

## Rollback de emergência

O rollback preferencial é republicar a revisão anterior da API; o schema e as
funções legadas continuam instalados. Se a API estiver indisponível e houver
aprovação explícita do responsável, executar o bloco abaixo em uma transação e
republicar temporariamente o cliente compatível da revisão anterior:

```sql
begin;
grant usage on schema private to authenticated;
grant select, update on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.entries to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select on public.audit_events to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_household_invite(uuid) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
commit;
```

Após recuperar a API, reconciliar dados e reaplicar a migration de corte em uma
nova migration forward-only. Não editar o histórico já aplicado.

## Evidência de encerramento

Anexar à GOM-101: URLs dos workflows verdes; revisão implantada; horário do
corte; consultas de privilégios; smoke tests; reconciliação; decisão de seguir
ou reverter; e confirmação de atualização do Notion e do Project Handbook.
