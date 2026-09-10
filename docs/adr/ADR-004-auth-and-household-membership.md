# ADR-004: autenticação e associação à residência

- Status: aceito
- Data: 2026-09-09
- Issue: GOM-78

## Contexto

O InOut precisa restaurar sessões em Android, iOS e Web e permitir que duas
pessoas compartilhem dados sem tornar um identificador enviado pelo cliente em
prova de autorização.

## Decisão

- Supabase Auth mantém identidades e sessões individuais.
- O cliente usa somente URL e chave publicável recebidas por `dart-define`.
- `household_members` é a fonte de autorização; metadados editáveis do usuário
  não participam das decisões de acesso.
- A primeira pessoa cria a residência pela RPC atômica `create_household`.
- A segunda entra com um código aleatório de uso único e validade de 24 horas.
- Apenas o proprietário cria convites e nenhum cliente escreve diretamente em
  `household_members`.
- A aceitação bloqueia a residência, valida o limite de duas pessoas e associa
  o usuário autenticado, reduzindo condições de corrida.
- Apenas o hash SHA-256 do convite é persistido.

## Consequências

O fluxo não exige acesso do cliente a `auth.users`, não revela UUIDs de outras
pessoas e permite revogar convites ao gerar um novo. Para ampliar a residência
além de duas pessoas será necessária uma decisão explícita de produto e uma
nova migração.
