# Categorias, subcategorias e fontes de renda

## Auditoria e entrega

A auditoria encontrou os resumos por categoria e por fonte com artes próprias, cadastro rápido de categorias/subcategorias/fontes nos lançamentos e os endpoints de cadastro, consulta e arquivamento. Não havia área completa de gestão React na web ou no mobile.

| Fluxo | Implementação entregue |
| --- | --- |
| Categorias | `/categorias`, entradas/saídas, busca, hierarquia e ativas/arquivadas |
| Nova categoria | Modal com nome e fluxo; reutiliza o contrato do cadastro rápido |
| Nova subcategoria | Mesmo formulário, com categoria principal ativa do mesmo fluxo; um nível |
| Detalhe da categoria | Painel, filhos ativos/arquivados e histórico diretamente classificado no ID |
| Arquivar categoria/subcategoria | Confirmação, bloqueio com filhos ativos e preservação histórica |
| Fontes de renda | `/gerenciar-fontes`, busca e ativas/arquivadas; o resumo `/fontes-renda` permanece |
| Nova fonte | Modal com nome e contrato do cadastro rápido |
| Detalhe da fonte | Histórico e participação líquida por moeda/período, incluindo estornos |
| Arquivar fonte | Confirmação e preservação da identificação das receitas antigas |

Web e mobile compartilham repositório e estado em `@inout/finance/catalog`. O cadastro pendente é persistido por usuário e residência antes do envio; a recuperação consulta o mesmo ID antes de reenviar. Categorias usam a chave de idempotência existente. Fontes preservam o ID original e são reconciliadas antes de uma nova tentativa. Conflitos de nome confirmados pelo domínio permitem corrigir o formulário. Respostas incertas não liberam outro cadastro.

## Backend

- GET/POST/DELETE de categorias e fontes existentes, com bearer token e escopo de residência.
- Listas usam `includeArchived=true`; moedas são obtidas também das contas arquivadas.
- Histórico aceita `categoryId` e `incomeSourceId` no cliente, inclusive nos links para a lista completa. Categoria principal exibe suas classificações diretas; cada filho tem acesso separado aos próprios registros.
- `GET .../dashboard/income?includeArchivedAccounts=true` adiciona uma consulta histórica às contas para a participação da fonte. O padrão continua sendo `false`, preservando os resumos anteriores e os saldos ativos do dashboard. A verificação de membership ocorre antes da leitura histórica.
- Percentual só é apresentado quando o total líquido é positivo e todos os grupos são não negativos; moedas não são somadas.

## Arte

`pipo-catalog.png`: Pipo organiza cartões em dois grupos, com uma muda ramificada.
`pipo-source-garden.png`: Pipo cuida de três plantas que representam fontes de renda.
A arte existente `pipo-archive.png` ilustra as confirmações de arquivamento. Formulários reutilizam a arte do seu módulo.

## Validação

- Testes Node cobrem regras de hierarquia, contratos HTTP, filtros do histórico, erro de leitura, dupla submissão, recuperação persistida, conflitos definitivos e consulta histórica opcional.
- Lint e TypeScript nas duas plataformas; build de produção web.
- Adicionados testes .NET de seleção da consulta histórica e integração com conta/fonte arquivadas. Não executados neste ambiente: SDK .NET e Docker não disponíveis.
- Validação visual em navegador/dispositivo e fluxo completo contra backend em execução permanecem pendentes.
