# GOM-93: logs e recuperação

Responsável: proprietário do projeto InOut. Banco de origem: Supabase InOut. O repositório é público; nenhum dump SQL ou chave deve ser enviado a ele.

## Logs e incidentes

- A API escreve JSON no console. Cada requisição concluída registra `CorrelationId`, método, endpoint registrado, status HTTP e duração em ms. Caminho real, query string, cabeçalhos, corpo e descrições financeiras não são registrados.
- Exceções de negócio continuam com códigos HTTP próprios. Falhas não previstas retornam HTTP 500 genérico e registram somente o tipo da exceção; mensagens e pilhas potencialmente sensíveis não vão aos logs. O ID de correlação aparece no cabeçalho `X-Correlation-ID`.
- Procure pelo ID nos logs do host da API. Confira `/health/live` e `/health/ready`. Para 5xx persistentes, interrompa novas gravações, preserve o ID e a janela de tempo, e investigue em ambiente separado.

## Backup diário

O workflow [backup.yml](../../.github/workflows/backup.yml) roda às 04:17 UTC e também por acionamento manual, **após** a configuração destes segredos no GitHub Actions:

1. `INOUT_BACKUP_DATABASE_URL`: string de conexão do banco Supabase com acesso de dump (use o pooler de sessão ou conexão direta; não use o pooler transacional).
2. `INOUT_BACKUP_PASSPHRASE`: segredo aleatório longo, gerado e armazenado fora do GitHub, por exemplo em um gerenciador de senhas. Perder a chave torna os arquivos irrecuperáveis.

O workflow falha explicitamente sem esses segredos. Ele exporta roles, schema e data com o Supabase CLI, compacta e cifra localmente com GPG AES-256. Somente `inout-backup.gpg` vai para o artefato do workflow, com retenção de sete dias. O stdout exibe apenas o hash do arquivo cifrado. Verifique diariamente o sucesso da execução e a existência do artefato. Não use os artefatos como único destino permanente para retenção superior a sete dias. Não execute esse workflow em PRs.

Supabase Pro/Team/Enterprise oferecem backups diários gerenciados conforme o plano; no Free, configure este workflow porque o provedor não garante essa retenção. Verifique o plano e a lista em **Database > Backups**. A criptografia protege o arquivo mesmo sendo um artefato de um repositório público. Backup do banco não inclui objetos binários do Supabase Storage; se passarem a ser usados, adicione um procedimento específico.

Meta inicial: RPO até 24 h, RTO até 4 h. Essas metas dependem de uma execução diária concluída e de um ensaio integral cronometrado; não são garantias medidas.

## Restauração em ambiente isolado

1. Registre instante do incidente, último backup íntegro, revisão da aplicação e das migrations. Pare escritas na origem se houver risco de corrupção. Não restaure sobre o banco de produção.
2. Crie um projeto Supabase **novo e vazio**, com a mesma versão principal de PostgreSQL, extensões e configurações necessárias. Obtenha a URL do banco **de destino**. Baixe o artefato `.gpg` de uma execução concluída; confira seu SHA-256 com o valor no log dessa execução.
3. Num host privado com `psql` e `gpg`, defina `RESTORE_DATABASE_URL` e `BACKUP_PASSPHRASE` sem registrá-los no histórico do shell. Execute `CONFIRM_ISOLATED_TARGET=yes bash tool/restore_database.sh /caminho/inout-backup.gpg`. O script aplica roles, schema e data numa transação, parando em qualquer erro. Nunca informe a URL da origem como destino.
4. Confira contagens de `auth.users`, `public.households`, `public.household_members`, `public.transactions` e `public.entries` com `psql` no destino; compare com uma medição salva da origem, se disponível. Confira extensões, RLS, políticas, associações de usuários a casas e reconciliação de saldos pelo endpoint da API. Verifique se o histórico de migrations precisa ser recriado conforme a documentação do Supabase. Configure chaves do Auth, provedores de login e secrets no novo projeto; não copie secrets para o repositório.
5. Teste login e uma leitura autorizada e não autorizada no ambiente isolado. Registre tempo de restauração, perda observada e resultado. Só depois considere alterar endpoints ou credenciais do aplicativo.

O CI ensaia dump, cifra, decifra e restauração de **dados** de uma tabela descartável num Supabase local recém reconstruído. Esse teste não substitui a restauração integral de um backup real em um segundo projeto antes do lançamento. O procedimento integral permanece pendente até a configuração dos segredos e a primeira execução de produção.
