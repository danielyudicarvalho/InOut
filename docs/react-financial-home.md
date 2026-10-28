# Financial home: real backend integration

The Next.js and Expo `/inicio` routes use the ASP.NET backend. Demo data files
have been removed. There is no fallback to fictitious balances, currencies,
residences, dates, people or transactions.

## Configuration

Keep the existing Supabase public URL/key settings. Add the API origin (without
`/api/v1`) to each client's ignored local environment file:

```dotenv
# frontend/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

# mobile/.env — use the machine's LAN address for a physical device
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8080
```

Use your deployed HTTPS API origin in production. Restart development servers
or rebuild after changing public environment variables. An HTTPS frontend needs
an HTTPS API. The API must accept the same Supabase issuer/audience as the clients.
Allow the exact web frontend origin through `Cors:AllowedOrigins`, e.g.
`Cors__AllowedOrigins__0=http://localhost:3000` in the API environment. Native
requests use the same bearer token; CORS applies to browser clients.
See `docs/cloud-docker.md` or `docs/local-docker.md` for the existing API setup.
No database password or service role key belongs in either client.

## Boundaries and behavior

`packages/finance` contains the framework-independent HTTP adapter and loading
store. React hooks in each app compose it with the existing Supabase session
client. This follows the project's application/infrastructure/presentation
separation and Clean Architecture chapter 23. The client formats server totals;
it does not recalculate the ledger or bypass membership authorization.

1. `GET /api/v1/households` returns only the user's memberships.
2. The chosen household drives six parallel monthly
   `GET /api/v1/households/{id}/ledger/dashboard?year=…&month=…` requests.
3. `GET /api/v1/households/{id}/ledger/accounts` supplies account kinds (metadata only; balances come from the period snapshot).
4. `GET /api/v1/households/{id}/ledger/history?from=…&to=…&limit=20`
   returns recent ledger entries for the selected month; the UI shows four.

All requests obtain the current session access token and send `Authorization:
Bearer …`. Responses are not cached. Redirects are rejected. Server messages,
tokens and bodies are not logged or exposed in errors. No household identifier
is accepted from an arbitrary URL; the selector uses the membership response.
The backend remains the security boundary and validates membership on financial
requests. Client UI gates alone are not authorization.

The default period is the current local calendar month. The period dialog offers current month, previous month, the current and two preceding complete calendar months, and an inclusive custom date range. The calendar and typed dates support 2000–9998. Applying commits the selection; closing/cancelling discards it. Monthly selection shows the selected and preceding five months; a custom range uses one aggregate bar/table entry for exactly the requested interval.
Currencies come from server summaries, including currencies beyond BRL/USD. Cents are formatted through BigInt parts to avoid floating-point rounding at large values.
Balances are as of `periodEnd`, not today's balances. Every amount remains in
its own currency. Summary income/expense/result are supplied by the domain
calculator; transfers are not recomputed as expenses. History displays entries,
so a transfer may appear once for each account. Recent entries can include
multiple currencies and retain their own currency formatting. There is no
cross-currency sum.

Missing historical currency summaries represent no totals for that currency in
that month. Negative historical totals (possible with corrections/reversals)
use a signed text/table presentation rather than misleading positive bars.
A false `isReconciled` result displays an alert. Empty memberships never trigger
financial queries. Empty accounts, empty history, absent configuration, expired
auth, denied membership, malformed responses, network failures and timeouts are
explicit states. Refresh reloads memberships. Switching household or period
clears the previous data immediately; cancellation, generation checks and a
20-second timeout keep obsolete responses from restoring it. Unmount cleans up.

Quick actions and areas without implemented forms still report their
unavailability. The account-creation and invitation previews elsewhere in the
app are not integrated by this change; this document describes the financial
home only.

## Verification

Seventeen adapter/store/formatting/period/composition tests verify exact routes, bearer headers, non-BRL/USD
amounts, history direction, empty membership, configuration/auth failures,
HTTP errors, invalid monetary values, stale response isolation, membership
revocation, timeout handling and calendar transitions. The complete web test
command runs 56 tests. Lint, typecheck and web/native production exports also
cover client composition and shared package resolution after clean installs.

No API was listening at localhost:8080 in the execution environment, and the
.NET runtime was unavailable. Live authenticated account data and browser/device
end-to-end acceptance were therefore not exercised. The adapter/store tests use
controlled HTTP responses for verification only; those responses are not
included in either application's runtime data source.

## Period selection contract

Monthly requests retain `year` and `month`. Custom requests use `from` and `to`
on both dashboard and ledger history endpoints, with no simultaneous monthly
arguments. The returned dashboard bounds must match the requested custom bounds.
The adapter never approximates a custom interval by adding full-month totals.
Presets and the Monday-first calendar share the package date helpers. Dates are
calendar values, not UTC timestamps; leap days and reversed/invalid intervals
are validated before any request. The native input format is DD/MM/AAAA.
Both clients keep an independent draft while the dialog/sheet is open.

## Balance composition and account details

`/composicao-saldo` is reachable from each dashboard balance card on web and
native. Navigation preserves membership-validated household, period and currency;
returning to `/inicio` restores those selections. Direct links are authenticated,
and a household missing from the membership response is rejected before querying
its ledger. Currency selection is limited to backend summaries.

The view uses `DashboardAccountBalance` fields from the same selected-period
snapshot as the consolidated summary: balance, inflow, outflow and net change.
The extra accounts endpoint supplies kind labels only; its current balances do
not overwrite historical snapshot balances. Details are read-only within the
composition screen and provide a return action. Credits/debits can include
transfers and adjustments; the view does not call them household income/expense.

Currencies never mix. Integer-cent totals are checked with BigInt against the
backend consolidated total; a discrepancy/reconciliation failure shows an alert.
Negative balances remain negative. Legend percentages use net balance and are
undefined when the net balance is zero. The segmented bar explicitly represents
absolute balances (negative accounts in orange), so it does not pretend a debt
is a positive share of the net balance. Hide-values masks amounts and removes
the distribution graphic/legend; it is a display privacy control, not encryption.

## Income details

The dashboard links to `/receitas` on web and native, preserving the authorized
household, selected currency and monthly or custom period. The clients fetch
`GET /api/v1/households/{householdId}/ledger/dashboard/income` with the same
period parameters as the dashboard and show actual posted income entries. A
signed income reversal reduces the total; transfers, expense reversals and other
currencies are excluded using the dashboard's own calculation rules. Account,
category and income-source details come from the ledger data.

The endpoint returns integer cents, a net total, reconciliation status and
pages of up to 200 entries. A fingerprint of the ordered result prevents clients
from combining pages when entries change during pagination. The clients also
compare the total with the dashboard and check the sum after all pages load.
The current reader materializes the period's postings on each page request, so
large ledgers may require a database-backed snapshot and pagination in future.

## Expense details

`/despesas` on web and native preserves the selected household, currency and
period and calls `GET /api/v1/households/{householdId}/ledger/dashboard/expense`.
The membership-checked endpoint applies the dashboard's expense and reversal
rules, returning signed contributions in integer cents. The total is net
expense; in the transaction list expenses are displayed as outflows and expense
reversals as inflows. Transfers and income do not become expenses. Pages carry
a fingerprint so clients do not combine different ledger snapshots. The same
full-period materialization caveat documented above applies to this endpoint.

## Result details

`/resultado` preserves household, currency and period when opened from the
result card. It uses the existing authenticated dashboard, income and expense
queries; no new backend endpoint is required. Income minus expense is checked
against the dashboard result, and each breakdown is checked against its dashboard
total and reconciliation state. Recent entries combine the first pages of both
breakdowns, sorted by date, with filters and links to the full income and expense
lists. Transfers are excluded by the existing backend classification. The
breakdowns are independent requests, so a changed total raises a warning; a
single transactional snapshot across all three requests is not guaranteed.

## Category summary

`/resumo-categorias` fetches the selected dashboard and the household category
catalog, including archived categories, under the current user's session. The
client aggregates each category's direct expense and descendants without double
counting. Unclassified expenses remain visible, and net negative categories do
not produce misleading pie-chart shares. The category drilldown reads paginated
expense entries and matches category IDs rather than names. Until all pages are
loaded it explicitly reports that the results are partial. The new expense DTO
includes `categoryId`; deploy the backend and clients together.

## Income source summary

`/fontes-renda` on web and native opens from the dashboard income card and
preserves the authorized household, selected period and currency. It uses the
income breakdown endpoint, whose response now includes the source identifier for
each item and complete `sources` totals and entry counts calculated before
pagination. The grouping uses source IDs, keeps equal names separate and retains
zero-net groups and entries without an assigned source. Reversals reduce income
using the dashboard classifier; transfers are excluded.

Client validation checks source totals and counts against the full breakdown.
The source accordion shows actual loaded entries, reports partial counts and
loads further ledger pages on request. The existing snapshot fingerprint prevents
combining changed pages. Percent charts are hidden when a net negative amount or
zero total makes proportions misleading. Details expose account, category,
date and signed amount. Deploy the API change with the clients; an older API is
reported explicitly instead of inventing source totals. The reader still loads
the period in memory, as documented for the other breakdowns.

## New record chooser and forms

The dashboard's new-record action opens a native web dialog or mobile bottom
sheet. Income, expense and transfer choices navigate to `/novo-registro` with
household, period, currency and kind. Closing/backing out performs no write.
Quick actions open the chosen form directly. The authenticated form verifies
membership before fetching active accounts, categories and income sources and
uses the existing .NET income, expenses and transfers POST endpoints.

Input validation retains integer cents, requires a category of the matching flow
and limits transfers to distinct accounts in one currency. Backend invariants
and authorization remain authoritative. A POST occurs only after the user saves.
The operation key and immutable payload are persisted before sending, scoped to
validated user ID and household, without storing access tokens. A timeout or
unknown response retains that key and locks edits until the same request can be
confirmed. Reopening the form restores the pending operation even if the user
chose a different kind. A confirmed result clears only its matching stored key;
a definitive validation error permits correction. Retries older than 30 days
are blocked rather than risking replay outside server retention (currently 90
days). Concurrent independent devices/tabs are not a single shared draft.

Pending inputs are stored in browser localStorage or mobile AsyncStorage until
confirmation. The client refuses to send when persistence fails. The native
client uses SDK-compatible expo-crypto for operation UUIDs. After success the
return action opens the month of the posted date and the account currency, so
the new record can be seen in its actual period.

## Dashboard setup states and real account creation

The dashboard distinguishes households with no active accounts from households
with accounts but no posted financial activity. The .NET response now includes
`hasFinancialActivity`, computed for the whole household independently of the
selected period and excluding opening-balance transactions. Missing metadata is
kept unknown by older clients/servers and never inferred from an empty month's
history. A transfer or reversal is financial activity. Reconciliation failures
also prevent the first-movement state from replacing an existing dashboard.

Each dashboard account includes its actual `initialBalanceCents`, read from its
opening-balance ledger entries. Setup cards keep accounts and currencies separate
and never substitute a historical period balance for the initial balance. If an
older response omits that field, the card explicitly labels its current balance.

The create-account CTA preserves household context and now uses the real account
creation endpoint. The account form supports zero and signed initial balances,
account kind, currency and opening date. Account creation and transaction entry
share one durable submission lifecycle while retaining separate pending-operation
namespaces. Generated account IDs and operation keys are restored unchanged on
retry. The old `/conta-pronta` route now reads the actual dashboard instead of
rendering an unverified success state. No new database tables are required.

## Histórico de lançamentos

`/lancamentos` (web e Expo) usa o endpoint autenticado de histórico da residência. Busca por descrição e filtros de conta/tipo são aplicados no servidor antes da paginação. O filtro opcional `Offset` foi acrescentado ao DTO de aplicação, com `offset` na rota GET e `Skip` antes de `Take` no adaptador EF; consultas antigas continuam começando em zero. Nenhuma migração é necessária.

A página solicita 51 movimentos por vez, exibe 50 e usa o último apenas para habilitar Próxima. O rodapé informa a quantidade da página, sem inventar um total global. A unidade é a movimentação em conta: uma transferência preserva suas duas pernas e pode atravessar páginas. O cliente não soma moedas nem transforma transferências em receita/despesa. Estornos preservam direção e referência ao lançamento original; os originais estornados continuam visíveis com valor riscado.

A paginação é por offset e reflete a consulta atual, sem snapshot: novos lançamentos podem deslocar registros entre páginas. A interface informa essa limitação e oferece Atualizar. Publicar backend e clientes juntos para habilitar offset; versões antigas do backend ignorariam o novo parâmetro.

Os hooks cancelam a consulta ao desmontar e ignoram respostas tardias. Cada conjunto de residência, período, filtros e página monta uma consulta isolada. A lista de residências é validada antes de consultar dados financeiros; acesso negado não mantém a lista anterior visível. Os detalhes são somente leitura, e Novo registro abre o seletor existente com residência/período/moeda.

## Painel de busca e filtros

O histórico abre um drawer modal no web e uma folha modal no Expo. A edição usa um draft local, separado dos filtros da lista. Fechar descarta a edição; Aplicar valida o intervalo inclusive e reinicia a página. Limpar remove texto/tipo/conta/categoria/subcategoria/fonte do draft e restaura o período que estava aplicado. Pílulas removíveis mostram os filtros adicionais em edição.

Os catálogos são carregados com autenticação e validação da residência antes das consultas, incluindo registros arquivados para encontrar classificações históricas. As categorias têm `parentId`; selecionar outra categoria limpa a subcategoria, e mudar tipo limpa categoria/subcategoria. A fonte só pode ser escolhida para Entrada e é removida ao aplicar outro tipo.

`categoryId`, `incomeSourceId` e `includeSubcategories` são encaminhados ao GET de histórico. O novo `LedgerHistoryFilter.IncludeSubcategories` é falso por padrão, preservando filtros exatos antigos. Quando verdadeiro, a consulta EF inclui a categoria e seus filhos diretos, compatível com o limite de dois níveis do domínio. Os filtros seguem antes de Skip/Take e dentro da transação do usuário. Nenhuma migração é necessária. Publicar backend e clientes juntos para obter o filtro por família de categoria.
