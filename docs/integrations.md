# Integrações: Resend, Sentry e PostHog

Todas são opcionais em desenvolvimento: sem chave, cada SDK fica desligado.

## Resend (e-mails de identidade)

| Variável | Onde | Observação |
|---|---|---|
| `Auth__Email__Delivery=resend` | API | `capture` em desenvolvimento; produção aceita só `resend` ou `smtp`. |
| `Auth__Resend__ApiKey` | API | Segredo. |
| `Auth__Email__From` | API | **Obrigatório em produção**, num domínio verificado no Resend. Sem domínio verificado o Resend só entrega para o dono da conta. |

## Sentry (erros)

| Variável | Onde |
|---|---|
| `Sentry__Dsn`, `Sentry__TracesSampleRate` (padrão 0.1) | API |
| `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Web (`instrumentation.ts` e `instrumentation-client.ts`) |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Build web/EAS, só para enviar source maps |
| `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | Mobile |

- A API não envia ao Sentry as exceções de regra de negócio (`HouseholdRuleException`, `FinancialRuleException`, `IdempotencyException`): elas já viram respostas 4xx.
- Na web, query string e fragmento são removidos das URLs enviadas (links de autenticação carregam `email` e `code`).

## PostHog (uso do produto)

| Variável | Onde |
|---|---|
| `PostHog__ApiKey`, `PostHog__Host` | API |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Web |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` | Mobile |

Regras de privacidade (dados financeiros):

- Só o id opaco do usuário é enviado em `identify`; nada de e-mail, nome, valores ou descrições.
- Web: sem autocapture, sem gravação de sessão, sem console; URLs sem query string (`before_send`).
- Mobile: telas registradas pelo caminho da rota, sem gravação de sessão.
- Taxonomia completa: documento "Event Taxonomy — InOut" (Drive, docs/product).
- Toda mensagem leva `source`, `client` (web/mobile na API; web/ios/android nos apps), `schema_version` e `app_version`. Eventos da residência levam o grupo `household` e `household_id`.
- API (enviados em segundo plano, nunca atrasam a requisição; repetições idempotentes não contam): `account_confirmed`, `signed_in` (troca de código ou ticket; renovação de token não conta), `household_created`, `household_invitation_created`, `household_invitation_accepted`, `household_member_left`, `financial_account_created`, `category_created`, `income_source_created`, `income_recorded`, `expense_recorded`, `transfer_recorded`, `transaction_reversed`, `transaction_reclassified`, `budget_set`, `goal_created`, `goal_allocation_recorded`, `recurring_plan_created`, `recurring_occurrence_realized`, `forecast_saved`, `ledger_exported`.
- Propriedades da API passam por uma lista permitida (`ProductEvents.AllowedProperties`); valores, descrições e nomes são descartados mesmo que um endpoint tente enviá-los. Para adicionar uma propriedade, inclua-a na lista e no documento de taxonomia.
- Web e mobile: `$pageview`/`$screen`, `record_form_started`/`record_form_submitted`/`record_form_abandoned`, `financial_command_failed` (via `setFinanceTelemetry` em `@inout/finance`), `summary_drilldown_opened`, `duplicate_resolved`.
- No projeto PostHog, mantenha desligados a gravação de sessão e a captura de console, e ligue a anonimização de IP.
