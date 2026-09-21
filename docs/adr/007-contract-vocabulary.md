# ADR-007 - Vocabulários fixos e strings de contrato

## Status

Aceito.

## Contexto

Strings que representam estados, tipos, códigos, rotas, headers e eventos são
parte de contratos. Quando repetidas nos consumidores, podem divergir sem que o
compilador detecte a mudança. Ao mesmo tempo, concentrar todo texto do sistema em
uma classe global criaria acoplamento entre camadas e esconderia o contexto.

## Decisão

- Tipos fechados do domínio são `enum`.
- Códigos de erro ficam junto ao domínio ou caso de uso que os define.
- Estados de persistência, nomes de eventos, entidades auditadas, métricas e
  nomes serializados ficam no vocabulário privado da infraestrutura.
- Claims, configuração, headers, rotas, nomes de endpoints e campos de problemas
  ficam no contrato da API.
- O cliente Flutter possui seu próprio contrato HTTP tipado e usa os enums do
  domínio para valores fechados, como `FinancialFlow`.
- Valores que são extensíveis por padrão, como códigos ISO de moedas, usam
  constantes nomeadas em vez de enums fechados.

## Exclusões deliberadas

- Textos apresentados ao usuário continuam na apresentação até a adoção de
  internacionalização.
- Nomes de tabelas e colunas permanecem explícitos no mapeamento EF, que é a
  fronteira canônica do schema.
- Migrations históricas são imutáveis. Seus literais documentam o schema no
  momento em que a migration foi aplicada.
- Testes podem repetir valores literais para verificar o contrato externo de
  forma independente das constantes da produção.

## Consequências

Renomeações contratuais passam a ter um ponto proprietário por camada. Novos
tipos fixos não devem ser adicionados diretamente em handlers, stores ou telas:
primeiro devem ser modelados no vocabulário da camada que possui o conceito.
