# Banco de dados e isolamento por residência

## Fonte da verdade

O PostgreSQL do Supabase é a fonte autoritativa dos dados compartilhados. Cada
usuário possui identidade própria no Supabase Auth; o acesso aos dados decorre
da associação em `household_members`, nunca de metadados editáveis do usuário.

## Modelo inicial

| Tabela | Responsabilidade | Chave de isolamento |
|---|---|---|
| `households` | Residência compartilhada | associação do usuário |
| `household_members` | Usuários e papéis `owner`/`member` | `household_id` |
| `accounts` | Contas e carteiras | `household_id` |
| `categories` | Categorias hierárquicas | `household_id` |
| `transactions` | Cabeçalho do fato financeiro | `household_id` |
| `entries` | Pernas contábeis | `household_id` |
| `budgets` | Limites por período e categoria | `household_id` |
| `goals` | Metas financeiras | `household_id` |
| `audit_events` | Trilha operacional somente para leitura do cliente | `household_id` |

Referências entre entidades usam chaves estrangeiras compostas com
`household_id`. Assim, mesmo uma operação privilegiada não consegue associar
uma transação da residência A a uma conta ou categoria da residência B.

## Autorização

- `authenticated` pode ler dados somente das residências em que é membro;
- membros podem operar dados financeiros da própria residência;
- somente `owner` gerencia membros e altera a residência;
- `anon` não recebe privilégios nem políticas;
- eventos de auditoria não aceitam escrita direta do cliente;
- a criação de residência usa `create_household(text)`, que grava a residência
  e seu primeiro proprietário atomicamente;
- uma constraint operacional impede a remoção do último proprietário.

As funções auxiliares de RLS ficam no schema não exposto `private`, usam
`security definer` com `search_path` vazio, possuem referências qualificadas e
execução restrita. Nenhuma decisão usa `raw_user_meta_data` ou outro campo que
o usuário possa alterar.

## Migrações e testes

As mudanças vivem em `supabase/migrations` e os testes pgTAP em
`supabase/tests/database`. Para reproduzir localmente:

```bash
supabase start
supabase db reset
supabase test db
supabase stop
```

A CI recria o banco a partir das migrações e valida estrutura, RLS, leitura
isolada, escrita permitida dentro da residência e tentativas cruzadas de
inserção e atualização.

