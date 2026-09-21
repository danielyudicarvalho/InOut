# ADR-008 - Sinais de mudança e reconciliação da residência

- Status: aceita
- Data: 2026-09-21

## Contexto

Uma residência pode ser usada simultaneamente em mais de um dispositivo. O
cliente precisa perceber mudanças compartilhadas e recuperar atualizações
perdidas durante uma desconexão, sem transformar o canal Realtime em uma segunda
API de negócio ou confirmar localmente uma gravação que o servidor não aceitou.

## Decisão

- A API ASP.NET e o PostgreSQL continuam sendo a fonte única da verdade.
- Toda mutação auditada insere, na mesma transação, uma linha mínima em
  `public.household_change_signals`.
- O cliente autenticado pode apenas observar sinais da própria residência; não
  lê entidades financeiras diretamente nem pode produzir sinais.
- Supabase Realtime transporta somente a invalidação. Ao receber um sinal, o
  cliente descarta projeções locais e consulta novamente a API.
- Toda inscrição ou reinscrição bem-sucedida também força reconciliação, cobrindo
  eventos perdidos enquanto o dispositivo esteve desconectado.
- Falhas do canal exibem estado offline. Falhas de transporte em comandos não
  navegam para sucesso nem descartam a identidade idempotente da intenção.

## Consequências

O mecanismo não depende de entregar todos os eventos: qualquer sinal ou
reconexão provoca uma leitura autoritativa. A tabela cresce com as mutações e
precisará de retenção operacional antes de volume relevante. Novas projeções
compartilhadas devem aderir à mesma invalidação, sem consumir o payload dos
sinais como dados de negócio.
