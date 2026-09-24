# Exportação CSV do razão financeiro

`GET /api/v1/households/{householdId}/ledger/export.csv` retorna o histórico completo do razão financeiro da residência. Exige JWT Supabase e participação na residência; uma requisição de não membro recebe `403`. O papel do banco também filtra as linhas por RLS. Não há filtro de período ou limite de 100 movimentos usado na tela de histórico.

O download é UTF-8 com BOM, linhas CRLF e separador `;`, para abertura em planilhas com localidade brasileira. Cada linha corresponde a um lançamento (`entry`). Uma transação ainda sem lançamentos aparece uma vez, com os campos de lançamento vazios. Contas e categorias arquivadas continuam identificadas nas movimentações antigas. Valores são inteiros em centavos e datas usam ISO 8601, sem arredondamento ou formatação regional. Aspas em texto são duplicadas e os campos são delimitados por aspas. Texto fornecido por usuários que poderia ser interpretado como fórmula recebe um apóstrofo inicial na representação CSV.

| Coluna | Conteúdo |
| --- | --- |
| `transaction_id`, `kind`, `status` | Identificador, tipo e situação da transação |
| `occurred_on`, `created_at`, `posted_at` | Data financeira, criação e postagem |
| `description` | Descrição, escapada para planilhas |
| `reversal_of` | ID da transação corrigida por esta reversão; vazio nos demais casos |
| `opening_account_id` | Conta do saldo inicial, quando aplicável |
| `entry_id`, `account_id`, `account_name`, `currency` | ID do lançamento e conta vinculada, nome e moeda |
| `category_id`, `category_name`, `category_parent_id`, `category_flow` | Categoria histórica vinculada e sua hierarquia atual |
| `direction`, `amount_cents` | Débito/crédito e magnitude positiva em centavos |

Para reconstruir um movimento, agrupe as linhas por `transaction_id`; mantenha o sentido de cada lançamento (`direction`). Para navegar pela correção, relacione `reversal_of` com `transaction_id`. Os IDs são estáveis. A descrição exportada pode ter um apóstrofo adicional apenas para neutralização de fórmula na planilha; o valor persistido permanece intacto.

Este CSV cobre o razão financeiro. Configurações de orçamento, metas e a lista de membros não integram o formato. O conteúdo contém dados pessoais e deve ser armazenado pelo usuário em local apropriado.
