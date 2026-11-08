# GOM-90 — revisão de segurança e privacidade

## Isolamento por residência

- As rotas financeiras exigem autenticação e autorização de membro (`LedgerEndpoints`); o painel também confere a participação no caso de uso.
- O papel `inout_api_runtime` não possui `BYPASSRLS`. Cada operação de banco define o sujeito do JWT na transação; o contexto não persiste na conexão ao final dela.
- `supabase/tests/database/cutover_and_rls.test.sql` cria duas residências com contas, categorias, transações, lançamentos e dados de painel. Verifica que o usuário A não lê, altera ou insere dados da B; que trocar o sujeito troca a visibilidade; e que um sujeito ausente não vê contas. O teste usa rollback.
- O cliente `authenticated` não tem acesso direto às tabelas financeiras após a migração de corte. A chave da API para PostgreSQL deve usar somente `inout_api_runtime`.

## Logs e segredos

- A API registra identificadores de correlação validados; não registra corpos de requisição nem cabeçalhos de autorização. EF Core não habilita logging de dados sensíveis. O gate `tool/check_logging_privacy.sh` bloqueia a ativação acidental dessas opções.
- `tool/check_secrets.sh` verifica arquivos `.env` versionados e padrões conhecidos de credenciais. Em caso de achado, o CI não imprime o valor encontrado. Não colocar dados domésticos reais em seeds, testes ou exemplos.
- Execute `bash tool/check_logging_privacy.sh` e `bash tool/check_secrets.sh` antes de publicar; o CI também os executa. Execute `supabase start && supabase db reset && supabase test db` para testar RLS com PostgreSQL local.

## Limites da verificação

Os gates de texto não substituem inspeção de histórico Git, secret scanning do provedor e revisão da configuração de logs e armazenamento em produção. A execução local de RLS requer Supabase CLI e Docker; resultados do CI devem ser conferidos antes do merge.
