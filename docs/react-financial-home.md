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
3. `GET /api/v1/households/{id}/ledger/history?from=…&to=…&limit=20`
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

Thirteen adapter/store/formatting/period tests verify exact routes, bearer headers, non-BRL/USD
amounts, history direction, empty membership, configuration/auth failures,
HTTP errors, invalid monetary values, stale response isolation, membership
revocation, timeout handling and calendar transitions. The complete web test
command runs 52 tests. Lint, typecheck and web/native production exports also
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
