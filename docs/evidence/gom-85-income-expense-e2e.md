# GOM-85 — Receitas e despesas ponta a ponta

## Fluxo entregue

- A tela inicial autenticada abre `Nova entrada` ou `Nova saída` em um toque.
- O formulário carrega contas e somente categorias compatíveis com o fluxo.
- Valor, conta e categoria são obrigatórios; a descrição permanece opcional.
- Cada envio recebe uma chave de idempotência UUID v4 e usa a API versionada.
- Após sucesso, o saldo derivado é recarregado imediatamente.

## Regras protegidas

- Receita credita apenas a conta selecionada.
- Despesa debita apenas a conta selecionada.
- Valor zero/negativo, conta externa e categoria externa ou de fluxo oposto são rejeitados.
- Novas residências recebem categorias mínimas no mesmo commit transacional.
- Tipos categóricos são enums centralizados no domínio e convertidos para texto somente na persistência.

## Evidência automatizada

- Integração PostgreSQL cobre receita de R$ 100,00 seguida de despesa de R$ 25,00,
  saldo final de R$ 75,00 e ausência de alteração em outra conta.
- Integração verifica rejeição de valor zero e categoria de fluxo oposto sem alterar saldo.
- Teste Flutter cobre leitura de categorias filtradas e contrato de despesa.
- O pipeline do PR executa .NET, Flutter, migrations/RLS, Web e Android.

## Operação Supabase

Não há alteração de schema nem migration adicional. O catálogo padrão é aplicado
transacionalmente pela aplicação ao criar uma residência.
