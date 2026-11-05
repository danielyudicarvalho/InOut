# Residência e colaboração

## Auditoria e resultado

Havia criação de residência, emissão/aceitação de convite no backend e artes de criação/convite. A aceitação nas telas React ainda era demonstrativa. Não havia gestão completa de membros, papéis, revogação ou saída na web/mobile.

| Fluxo | Entrega |
| --- | --- |
| Minha residência | `/residencia`: nome, contexto, papel atual e gestão |
| Membros e detalhe | Painéis de participantes, papel, entrada e identificação disponível; sem métricas financeiras individuais |
| Convidar | Código real de 48 caracteres, uso único e validade de 24 horas; copiar na web e via Expo Clipboard no mobile |
| Convites | Até 50 recentes, com validade e situação; emissão substitui pendentes anteriores, revogação disponível |
| Alterar papel | Confirmação com explicação das permissões e validação no domínio/API/banco |
| Remover ou sair | Perde acesso sem apagar lançamentos, contas ou autoria histórica |
| Acesso removido | `/acesso-removido` e guarda de acesso nas telas financeiras |
| Selecionar residência | `/selecionar-residencia`, apenas memberships atuais |

O modelo mantém dois participantes por residência e dois papéis. **Membro** compartilha integralmente as finanças e pode sair. **Responsável** também gerencia participantes/convites. Não foi introduzido acesso somente de leitura nem permissão por lançamento. Há suporte a múltiplas residências por usuário; IDs explícitos não autorizados nunca são substituídos silenciosamente por outro contexto.

Não existe perfil público de participante na base atual. A identificação usa o ID real da participação, com “Você” para o próprio usuário e rótulo abreviado para o outro. Nomes e e-mails não são inventados ou obtidos de `auth.users`. Informações financeiras individuais não são acrescentadas ao detalhe.

## Backend e banco

- GET `/api/v1/households/{id}/context` exige participação atual.
- GET/POST `/api/v1/households/{id}/invitations`, DELETE `.../invitations/{invitationId}`: gestão pelo responsável.
- PUT `.../members/{userId}/role`, DELETE `.../members/{userId}` e POST `.../leave`.
- `HouseholdMembership` centraliza autorização e proteção do último responsável. Deve-se promover outro participante antes de sair ou perder o papel. A última pessoa não pode abandonar o contexto sem sucessão.
- Alterações são serializadas por advisory lock transacional da residência; há trigger de defesa contra remoção/rebaixamento do último responsável. RLS/GRANTs limitam UPDATE de membros à coluna `role` e proíbem autopromoção de membros.
- Auditagem ocorre antes da saída para preservar acesso às políticas de auditoria. A remoção exclui somente a participação, não o usuário nem os seus registros históricos.
- Convites guardam hash, nunca o código original. A migração adiciona `revoked_at`; emissão de novo código revoga os pendentes, em vez de apagar seu histórico. Remoção ou rebaixamento de responsável também revoga seus códigos pendentes.
- Aceitação usa o código real e confirma no servidor; replay de um código já aceito pelo mesmo usuário retorna o contexto somente enquanto a participação continuar ativa.
- O cliente consulta memberships a cada 15 segundos e ao voltar ao foco/primeiro plano. Perda de participação fecha/desmonta a tela financeira e indica um contexto autorizado. Durante falha na verificação, o conteúdo financeiro fica oculto. Cada requisição continua sujeita à autorização dinâmica do servidor.

## Arte e navegação

Artes novas `pipo-household.png` (lar compartilhado) e `pipo-household-path.png` (seleção/encerramento de acesso). Confirmações reutilizam a arte do lar; a aceitação mantém as artes de envelope/revisão existentes. Entradas disponíveis em Configurações/Mais, Contas, painel inicial vazio e “Abrir minhas residências”.

## Validação e aplicação

- Testes Node cobrem contratos, normalização/validação de código, último responsável, mudança de contexto, perda de acesso, dupla submissão e retirada do código após perda do papel.
- Lint/TypeScript web e mobile e build web de produção.
- Migração executada em PostgreSQL embarcado (PGlite) com fixture reduzida e RLS: autopromoção negada, último responsável protegido, sucessão permitida, acesso financeiro retirado, autoria preservada e revogação pelo responsável.
- Testes de domínio/integração .NET e teste pgTAP adicionados. SDK .NET, Docker e Supabase local completo não estão disponíveis, portanto essas suítes completas e o teste ponta a ponta ainda não foram executados.
- Migração `20261105163530_household_collaboration_management.sql` preparada, não aplicada a banco remoto. Aplicar junto do backend antes de habilitar os clientes atualizados. Nenhuma publicação, deploy ou alteração remota foi executada.
- A instalação de `expo-clipboard` foi feita com o resolvedor do Expo SDK 58 e incluída no lockfile. Validação visual em navegador/dispositivo permanece pendente.
