# Inventário de limites Supabase e plano de migração

- Issue: [GOM-96](https://linear.app/gomi/issue/GOM-96/inventariar-rpcs-acessos-diretos-e-contratos-supabase-do-inout)
- Epic: [GOM-95](https://linear.app/gomi/issue/GOM-95/adotar-backend-dedicado-aspnet-e-migrar-regras-de-negocio)
- Decisão: [ADR-005](adr/ADR-005-dedicated-aspnet-backend.md)
- Estado observado: banco InOut e repositório GitHub
- Regra vigente: nenhuma nova RPC de negócio

## Objetivo

Estabelecer o baseline anterior à introdução da API ASP.NET Core. O inventário separa o que é identidade, caso de uso, consulta, persistência e defesa em profundidade para que cada comportamento seja migrado uma única vez, com testes de caracterização e rollback.

## Estado das fontes

| Fonte | Estado observado | Consequência |
|---|---|---|
| GitHub `main` | não contém `supabase_flutter` nem os adaptadores Supabase da GOM-78 | ainda não existe consumidor Supabase ativo na linha principal |
| PR #8 | contém Auth, acesso direto a `households` e três chamadas RPC | deve ser reconciliada com ADR-005 antes do merge |
| Supabase InOut | schema e funções da GOM-78 já aplicados; tabelas vazias | banco está adiante da `main`, mas ainda permite migração sem dados reais |
| Edge Functions | nenhuma implantada | não há runtime adicional para migrar |

## RPCs públicas de negócio

| Função | Consumidor conhecido | Regra atual | Destino ASP.NET | Situação transitória |
|---|---|---|---|---|
| `create_household(text)` | `SupabaseHouseholdRepository.create` na PR #8 | cria residência e primeiro owner atomicamente | `POST /api/households` e caso de uso `CreateHousehold` | caracterizar antes de substituir |
| `create_household_invite(uuid)` | `SupabaseHouseholdRepository.createInvite` na PR #8 | autoriza owner, limita dois membros, invalida convite anterior, gera segredo de 48 caracteres e persiste hash com expiração de 24h | `POST /api/households/{id}/invitations` e `CreateHouseholdInvitation` | manter somente durante migração |
| `accept_household_invite(text)` | `SupabaseHouseholdRepository.acceptInvite` na PR #8 | valida sessão e convite, bloqueia concorrência, impede terceiro membro, adiciona o usuário e consome convite | `POST /api/household-invitations/accept` e `AcceptHouseholdInvitation` | manter somente durante migração |

Na GOM-99, os quatro fluxos de residência passam por padrão pela API ASP.NET e
pelo `ApiHouseholdRepository`. O adaptador RPC permanece temporariamente atrás
de `--dart-define=USE_LEGACY_HOUSEHOLD_RPC=true`, que constitui o rollback da
janela de compatibilidade. A remoção das permissões e RPCs ocorre somente na
GOM-101.

As três funções são `SECURITY DEFINER`, têm `search_path` vazio e concedem execução a `authenticated` e `service_role`. `anon` e `PUBLIC` não possuem execução. Elas continuam protegidas enquanto forem compatibilidade, mas não recebem novas regras.

## Funções privadas técnicas

| Função | Uso | Classificação | Destino |
|---|---|---|---|
| `private.is_household_member(uuid)` | predicado reutilizado por RLS | defesa em profundidade | preservar |
| `private.is_household_owner(uuid)` | predicado de autorização no banco/RPC legado | defesa em profundidade | preservar durante e após revisão das policies |
| `private.protect_created_by()` | trigger contra alteração de autoria | integridade técnica | preservar |
| `private.protect_household_id()` | trigger contra mudança de residência | integridade técnica | preservar |
| `private.protect_last_household_owner()` | impede remover o último owner | invariante de segurança complementar | preservar e também implementar no domínio C# |

Função técnica não é automaticamente um caso de uso. O backend C# aplica a regra primária; triggers, constraints e RLS limitam o impacto de defeitos e acessos indevidos.

## Acesso direto do Flutter observado na PR #8

| Operação | Implementação | Classificação | Decisão |
|---|---|---|---|
| autenticar, cadastrar, sair e restaurar sessão | `SupabaseAuthRepository` | identidade | manter Supabase Auth |
| observar mudança de sessão | `auth.onAuthStateChange` | identidade | manter no cliente |
| listar residências | `.from('households').select('id,name')` | consulta de negócio | substituir por `GET /api/households` |
| criar residência | RPC | comando de negócio | migrar para API |
| criar convite | RPC | comando de negócio | migrar para API |
| aceitar convite | RPC | comando de negócio | migrar para API |

Após a primeira fatia vertical, o Flutter mantém o SDK Supabase somente para autenticação/sessão. O token de acesso acompanha chamadas HTTPS à API; o cliente não recebe credencial de serviço.

## Privilégios atuais relevantes

O papel `authenticated` possui leitura e escrita direta em várias tabelas de negócio, incluindo `accounts`, `budgets`, `categories`, `entries`, `goals` e `transactions`, sempre condicionado pelas policies RLS. Possui acesso mais restrito em `households`, `household_members` e `audit_events`.

Esses privilégios não serão revogados agora: a aplicação pode depender deles durante a transição. A GOM-101 deverá revogar escrita direta por módulo somente depois que o Flutter usar a API, a telemetria confirmar o novo caminho e o rollback estiver testado.

## Contratos a caracterizar

### CreateHousehold

- requer usuário autenticado;
- rejeita nome vazio ou fora do limite;
- cria residência e owner na mesma transação;
- atribui autoria ao usuário autenticado;
- não confia em identificador de usuário enviado pelo cliente.

### CreateHouseholdInvitation

- requer usuário autenticado e owner da residência;
- bloqueia criação quando já existem dois membros;
- invalida convite anterior ainda aberto;
- retorna segredo opaco de 48 caracteres;
- persiste apenas SHA-256;
- expira em 24 horas.

### AcceptHouseholdInvitation

- rejeita código inválido, expirado ou consumido;
- associa sempre o usuário do token;
- rejeita membro repetido e terceiro membro;
- serializa aceitações concorrentes;
- consome o convite e retorna a residência na mesma transação.

### ListMyHouseholds

- deriva o usuário exclusivamente do JWT;
- retorna apenas residências ligadas em `household_members`;
- não aceita filtro capaz de ampliar autorização.

## Matriz de testes de caracterização

| Cenário | Unitário C# | Integração PostgreSQL | Contrato HTTP | Segurança/RLS |
|---|---:|---:|---:|---:|
| criar residência e owner | sim | sim | sim | sim |
| nome inválido | sim | sim | sim | não |
| owner cria convite | sim | sim | sim | sim |
| membro comum cria convite | sim | sim | sim | sim |
| convite inválido/expirado/usado | sim | sim | sim | não |
| duas aceitações concorrentes | não | sim | sim | sim |
| terceiro membro | sim | sim | sim | sim |
| acesso cruzado entre residências | não | sim | sim | sim |
| repetição idempotente | sim | sim | sim | não |

Os testes não precisam reproduzir mensagens SQL literais. Devem preservar semântica, códigos de erro estáveis, atomicidade, autorização e efeitos persistidos.

## Sequência de migração

1. Reconciliar a PR #8 com ADR-005, evitando consolidar o adaptador RPC como arquitetura final.
2. Executar GOM-97 e criar a solution ASP.NET.
3. Executar GOM-98 e validar JWT, autorização por residência e conexão PostgreSQL de menor privilégio.
4. Implementar `ListMyHouseholds`, `CreateHousehold`, `CreateHouseholdInvitation` e `AcceptHouseholdInvitation`.
5. Criar `HttpHouseholdRepository` no Flutter e preservar `SupabaseAuthRepository`.
6. Rodar caracterização, integração, contrato, RLS e E2E.
7. Observar o novo caminho e reconciliar resultados.
8. Na GOM-101, revogar acesso direto e remover RPCs públicas obsoletas.

## Gates para remoção do legado

Uma RPC ou permissão só pode ser removida quando:

- não houver consumidor no código publicado;
- testes de paridade e contrato estiverem verdes;
- deploy e rollback do backend tiverem sido exercitados;
- logs e métricas confirmarem uso do endpoint novo;
- dados e efeitos tiverem sido reconciliados;
- a migration de revogação tiver teste negativo;
- documentação e runbook estiverem atualizados.

## Riscos identificados

- **Drift atual:** banco e PR #8 estão adiante da `main`.
- **Conflito da PR #8:** aparece como não mesclável após mudanças arquiteturais na `main`.
- **Duplicação temporária:** C# e PL/pgSQL coexistirão durante a janela de migração.
- **Privilégios amplos:** `authenticated` ainda pode escrever diretamente em tabelas financeiras sob RLS.
- **Sem dados de produção:** reduz o risco da migração, mas não elimina testes de concorrência e autorização.

## Decisão operacional

A GOM-96 termina com este inventário. A GOM-97 inicia a implementação do backend. A GOM-95 permanece em andamento até que GOM-97 a GOM-101 estejam concluídas e todos os gates de corte tenham sido satisfeitos.
