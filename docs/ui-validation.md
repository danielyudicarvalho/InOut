# Validação da primeira entrega de UI

Data: 2026-10-22.

- Next.js: build de produção e TypeScript aprovados.
- React Native: TypeScript e Expo lint aprovados; bundles Android/iOS gerados com Metro.
- Ilustração gerada a partir da referência enviada, inspecionada e empacotada localmente em ambas as aplicações.
- QA visual e interação no navegador: bloqueados. A abertura inicial do preview retornou conexão recusada e a tentativa posterior foi rejeitada pela política do navegador. Não houve inspeção visual do resultado renderizado.
- Testes em dispositivo/emulador e builds nativos APK/IPA: não executados neste ambiente.
- CTAs de login/cadastro mostram modais informativos; integração de autenticação e próximas telas ainda pendentes.

Antes de integrar à main, revisar desktop e larguras de 360/390/430px, navegação por teclado, contraste, zoom e tamanho de texto, VoiceOver/TalkBack e comportamento dos modais/voltar no Android. Validar a tela em Android e iOS.

## Login screen — 2026-10-22

- Web route: `/entrar`; welcome login and skip buttons navigate there.
- Mobile: Expo Router, welcome route and `/entrar`; native back navigation.
- Email/password fields, password visibility, required-field feedback, keyboard avoidance on mobile.
- No credentials are sent or stored. Authentication, password recovery and registration remain unintegrated; actions communicate this explicitly.
- Reuses the Pipo illustration already committed for welcome, rather than the different artwork in the login reference.
- Passed: Next production build, mobile TypeScript/lint, Android and iOS Metro exports.
- Browser preview renders, but clicks did not produce observable React state changes in this preview environment. Interaction QA remains blocked; do not treat build/export success as device or browser interaction verification.

## Create account screen — 2026-10-22

- Added `/criar-conta` in Next.js and Expo Router; welcome and login link to it.
- Name, email, password and confirmation fields; independent password visibility controls.
- Required fields, email syntax, minimum eight-character password and matching confirmation checked locally. These UI checks are not the final backend password policy.
- Explicitly distinguishes user registration from later financial-account setup.
- Registration does not send or persist credentials; valid submission explains that authentication integration is pending. Legal-document controls report their unavailable preview state.
- Reuses the existing Pipo illustration, which differs from the supplied registration reference.
- Formatting, ESLint and TypeScript checked in both clients. Native device and browser visual/interaction QA remain pending.

## Email confirmation states — 2026-10-22

- Added `/confirmar-email`, `/email-confirmado` and `/link-invalido` to web and mobile.
- Pending, confirmed and invalid/expired-link presentations follow the supplied reference layout and copy, reusing the existing Pipo asset.
- All screens explicitly identify themselves as UI previews. The displayed email is illustrative; no email, token or account information is read from URL parameters.
- Login links navigate to `/entrar`; resend/request actions state that delivery is not integrated and do not claim an email was sent.
- Preview-state navigation permits reviewing all three screens without simulating actual verification. No authentication status is changed.
- Registration remains unintegrated and does not imply that a confirmation email was sent.
- Exact envelope artwork, browser visual/interaction checks and native-device verification remain pending.

## Password recovery — 2026-10-22

- Added `/esqueci-senha` for web and mobile and connected both login recovery links.
- Email validation precedes the check-email presentation; users can return to login or enter another email.
- The result uses conditional account-neutral wording. A persistent preview notice explicitly says delivery is unintegrated and no email was sent.
- No API calls, persistence, password changes or recovery-token handling added.
- Reuses existing Pipo artwork; the key/envelope illustration and visual/native-device acceptance remain pending.

## Set new password — 2026-10-22

- Added `/redefinir-senha` in web and mobile with independent password visibility, minimum eight characters and matching confirmation validation.
- Submission clears password inputs and shows the reference completion state with an explicit preview notice: no password is actually updated.
- No token handling, API call, credential persistence or authentication/session change. Backend recovery validation remains required.
- Login navigation and reviewing the form work locally. Existing Pipo art is reused; reference-specific key artwork and visual/device acceptance remain pending.

## Session restoration states — 2026-10-22

- Added `/preparando`, `/sessao-expirada` and `/falha-acesso` for web and mobile.
- Centered loading, expired-session login action and restore-error retry/login actions.
- Explicit preview notices and demo-state navigation. Retry displays loading for 1.2 seconds then returns to the error preview; timer is cleaned up on unmount. No session check, network request, logout or token change occurs.
- Loading preview has a login escape; web spinner respects reduced motion.
- Existing Pipo illustration reused; reference-specific imagery and visual/device QA remain pending.

## Household onboarding choice — 2026-10-23

- Added `/comecar` for web and mobile with create-residence and invitation cards.
- Card actions explain the upcoming flows; no household or membership is created. Exit navigates to login, without claiming to revoke an authenticated session.
- Web dialog supports Escape/close; native modal supports Android back. Both include an explicit dismissal action.
- Existing Pipo asset and library icons reused; exact house/envelope illustrations and browser/device acceptance remain pending.

## Create residence — 2026-10-23

- Added `/criar-residencia` in both clients and connected the create action from `/comecar`.
- Name defaults to Meu Ninho; BRL and America/Cuiaba selected initially. Currency and IANA time-zone selections are interactive, with supporting text.
- Name must contain non-whitespace text and is limited to 100 characters. Submission reports that nothing was persisted; API integration and authoritative validation remain pending.
- Native option modals have selected states, cancellation and Android back dismissal. Back returns to onboarding; exit returns to login.
- Existing illustration reused. Exact reference artwork and visual/device QA remain pending.

## Dedicated create-residence artwork — 2026-10-23

- Replaced the reused welcome artwork on this screen with two reference-guided assets generated using built-in image generation.
- Desktop prompt: Pipo holding a leafy twig while building an empty nest on a warm sunlit desk, green-roof cottage, window, flowers, notebook and pencil; soft 3D storybook style; no UI or text.
- Mobile prompt: compact transparent illustration of Pipo at left beside the green-roof cottage at right, surrounded by leaves and white flowers; no UI or text.
- Web assets: `frontend/public/images/pipo-create-residence-desktop.webp` (1200×960) and `pipo-create-residence-mobile.webp` (1000×400, alpha preserved).
- Native asset: `mobile/assets/pipo-create-residence-mobile.webp`, identical to the narrow-web image. Native uses contain; web switches artwork at 760px and preserves full compositions.
- Generated artwork inspected directly and desktop placement inspected in cloud-browser preview. Both apps passed formatting, lint and TypeScript checks. Native-device verification remains pending.

## Invitation entry and review — 2026-10-23

- Added `/entrar-convite` in Next.js and Expo Router, connected from onboarding.
- Entry and review are separate local states; back preserves entered code, and Agora não returns to onboarding.
- Explicit demo code NINHO-7K2M reveals only the fixed fictitious residence Ninho da Família and inviter Ana. Other codes report demo-only validation. No remote invitation lookup, acceptance or membership mutation occurs.
- Confirmation explicitly states no residence was joined. No financial data is shown.
- Four dedicated built-in image-generation assets based on the supplied reference: desktop envelope scene and transparent mobile envelope illustration; desktop welcome-by-cottage scene and transparent mobile welcome illustration. Prompts preserve Pipo's yellow body, leafy tuft, brown wings and red scarf; warm storybook style; no UI/text.
- All four generated images inspected directly; desktop entry artwork placement inspected in cloud browser. The cloud preview did not show the step transition after filling/clicking, so browser interaction acceptance and native-device QA remain pending.

## Invitation results — 2026-10-23

- Added accepted, expired, invalid and already-used result previews in web and mobile: `/convite-aceito`, `/convite-expirado`, `/convite-invalido`, `/convite-utilizado`.
- Review confirmation opens accepted preview. Demo codes NINHO-EXPIRADO, NINHO-INVALIDO and NINHO-USADO open matching result screens; NINHO-7K2M keeps review first.
- All result screens clearly state no invitation lookup, acceptance or membership mutation occurred. Residence access/listing buttons explain that those features are not implemented; retry/code-edit links return to entry.
- Four distinct transparent built-in generated illustrations, shared between web/mobile: accepted Pipo with cottage/checkmark; concerned Pipo with envelope/clock; puzzled Pipo with envelope/question mark; Pipo with open envelope/information badge. Reference-guided storybook style, no interface text.
- All four illustrations inspected directly; accepted desktop layout inspected in browser preview. Both clients passed formatting, lint and TypeScript checks; web production build passed. Browser interaction acceptance and native-device QA remain pending.

## First financial account — 2026-10-23

- Added `/configuracao-inicial` and direct success preview `/conta-pronta` in Next.js and Expo Router. Create-residence screen links to account setup explicitly as a preview.
- Name, BRL/USD/EUR currency, signed opening balance and opening date inputs; empty names and malformed balances rejected. Native date validates actual calendar day in DD/MM/YYYY format; web uses required native date input.
- Opening balance explained as existing money, not new income. Submission switches only local preview state; no account, ledger entry or residence is persisted. Configure-later returns to onboarding. First-income/expense buttons explain that their forms are a future step.
- Three dedicated reference-guided assets generated with built-in image generation: desktop happy Pipo with green wallet, notebook, orange-roof cottage and flower garden; mobile transparent Pipo/wallet/flowerpot; success transparent jubilant Pipo/wallet/checkmark. Character retains golden body, leafy tuft, brown wings and red scarf; cozy 3D storybook style; no UI or text.
- Assets: `frontend/public/images/pipo-first-account-{desktop,mobile,success}.webp`; mobile and success copied identically to `mobile/assets/`. Desktop 1200×960, transparent variants 1200×480. All three artwork compositions inspected directly; desktop screen inspected in browser.
- Cloud preview rendered the form but submitted it as a native GET instead of applying the React event handler, consistent with earlier preview interaction limitations. Browser interaction acceptance and native-device QA remain pending.
- Both clients passed Prettier, ESLint and TypeScript checks; web production build passed with both new routes. React checklist reviewed: event-driven state, static native asset requires, input labels, keyboard avoidance and accessible action targets. Direct success route in cloud preview remained stale after reload, so success visual acceptance also remains pending.

## React client authentication — 2026-10-23

- Replaced signup/signin/confirmation placeholders with application operations behind the shared identity port and Supabase adapter. Confirmation routes now verify real provider state rather than presenting arbitrary success.
- Added pending/safe errors, reentrancy guards, normalized identity email, OTP/resend, fixed PKCE callbacks, session restoration and sign-out. `/comecar` verifies identity without querying household membership.
- Shared application and adapter tests plus actual SDK tests with mocked HTTP Auth transport; no live account, email or data mutation performed. Connected InOut project public settings were obtained and saved only in ignored local environment files. The live public Auth settings endpoint returned HTTP 200, email enabled, confirmation required, and signup enabled. Live email/account flows and device verification remain pending.
- Formatting, ESLint and TypeScript passed for both clients; Next production build and Android/iOS Metro exports passed. See `docs/auth-react-clients.md` for setup, remaining checks and book rationale.

## Password recovery — 2026-10-24

- Implemented real Auth recovery requests, dedicated `/auth/recuperar` PKCE callbacks and password updates for web/mobile. Generic email response, loading/errors, duplicate-submit guard and resend interval. Removed preview-only navigation and false password-success states.
- Reset UI requires a freshly exchanged recovery flow tied to the authenticated user, expires after fifteen minutes, validates passwords and reports local sign-out failure separately after a successful password update. Same-browser/app PKCE and in-memory reset-grant limitations are documented in `auth-react-clients.md`.
- Three dedicated built-in image-generation assets guided by the supplied reference: desktop Pipo with golden key, envelope, notebook, mug and nest by a sunlit window; transparent mobile Pipo/key/envelope among leaves/white flowers; transparent sent-state Pipo hugging an envelope. Cozy 3D storybook style, green tuft/brown wings/red scarf; no UI or lettering. All compositions inspected directly.
- Assets: `frontend/public/images/pipo-recovery-{desktop,mobile,sent}.webp` (1122×1402 desktop, 1200×480 transparent variants); native copies of mobile/sent in `mobile/assets/`. Alpha preserved. Request and reset screens use this artwork.
- Live email/password changes and device deep-link acceptance remain pending. Additional Supabase recovery redirect URLs must be configured; connected tools do not expose those settings.
- Thirty shared/SDK tests passed. Both clients passed formatting, ESLint and TypeScript; Next production build and Android/iOS bundle exports passed. Desktop request layout inspected in browser; actual email/password flows and device QA remain pending.

## Reset-password reference refinement — 2026-10-24

- Applied the supplied Definir nova senha / Senha alterada reference to the existing integrated web and native screens. Desktop success uses a compact two-column panel; mobile remains vertical. Success copy now states that the new password was saved, and duplicate generic check icons were removed.
- New dedicated built-in image-generation assets, inspected directly: desktop Pipo holding a golden key beside a closed green notebook, pencil, mug and nest at a sunlit window; transparent mobile Pipo/key among leaves and white flowers; transparent success Pipo/key beside a golden padlock with a green check badge. Golden body, leafy tuft, layered brown wings, red scarf; cozy 3D storybook style; no lettering, UI or envelopes.
- Web paths: `frontend/public/images/pipo-reset-{desktop,mobile,success}.webp`. Native copies: `mobile/assets/pipo-reset-{mobile,success}.webp`. Desktop preserves portrait framing; mobile/success retain alpha and contain sizing.
- Password fields and visibility toggles are blocked while saving. The existing application service, recovery-grant validation, provider update, error handling and local sign-out continue to determine actual completion; no demo success bypass was introduced.
- Real email/reset and native-device acceptance remain pending; the Supabase recovery redirect setup from `auth-react-clients.md` still applies.
- All thirty existing authentication regression tests passed; both clients passed formatting, ESLint and TypeScript. Next production build and Android/iOS exports passed after the finalized assets were copied. Actual ready/success screenshots through a live recovery link and device QA remain pending.

## Session restoration — 2026-10-26

- Implemented real preparation/restoration, expired and failed-access UI in both clients. Root startup and the authenticated onboarding gate use a shared application controller. Successful login/immediate-session signup goes through `/preparando`; valid identities continue to onboarding, anonymous startup reaches welcome, unconfirmed identities go to confirmation.
- Removed fake retry timers and demo links. Provider/network failure offers retry; absent/revoked credentials show sign-in. Fifteen-second UI timeout, stale-result rejection, subscription cleanup, duplicate retry protection and foreground revalidation are covered by tests. No household or financial calls added.
- Three dedicated transparent illustrations generated with the built-in image tool from the supplied reference: Pipo calmly seated in a woven nest with leaves/white flowers; Pipo inviting the viewer beside a golden key; concerned Pipo beside a gray cloud with crossed Wi-Fi symbol. Golden fluffy body, brown wings, red scarf and green leafy tuft; cozy 3D storybook style; no lettering/UI. All artwork inspected directly.
- Web assets: `frontend/public/images/pipo-session-{loading,expired,error}.webp`, 1000×600 RGBA. Identical copies in `mobile/assets/`; contain sizing preserves full composition. Web spinner honors reduced motion; mobile uses ActivityIndicator.
- Live refresh/revocation, cross-tab sign-out and native-device/foreground acceptance remain pending. The status views do not replace backend authorization.
- Thirty-nine authentication/application/SDK regression tests passed. Both clients passed formatting, ESLint and TypeScript; Next production build and Android/iOS exports passed. Cloud-browser preview returned connection-refused despite restarting the local preview; full screen visual/browser acceptance remains pending. Image compositions were inspected directly.

## Household entry choice — 2026-10-26

Reference: `image(20261026-191112).png`. Updated the authenticated `/comecar`
view in Next.js and Expo with three dedicated transparent illustrations, two
choice cards, desktop columns and a compact invitation card on narrow/native
screens. The existing session gate and real sign-out remain in place; errors are
announced and the busy action is disabled. Web destinations are semantic links.
Removed the unreachable preview dialog/modal and its unused state/effect.

Creating a residence and accepting an invitation on subsequent screens still
require their existing API integration work; this change only navigates to those
screens and does not save memberships. No database or domain rule was changed.
Clean Architecture, chapter 23 (Presenters and Humble Objects), guided keeping
this view concerned with presentation/navigation and retaining authentication in
the existing identity boundary. Reviewed with the React best-practices skill:
no added effects, dependencies, provider subscriptions, or business logic.

Artwork was generated with the built-in image generator, inspected directly,
and encoded as RGBA WebP. Final paths (identical copies for each platform):

- `frontend/public/images/choice-hero.webp`, `mobile/assets/choice-hero.webp` (1200×480).
- `frontend/public/images/choice-create.webp`, `mobile/assets/choice-create.webp` (600×300).
- `frontend/public/images/choice-invite.webp`, `mobile/assets/choice-invite.webp` (600×300).

Prompt set: shared prefix “Use case: illustration-story. Production transparent
web and mobile UI asset for Ninho.” Subjects respectively: Pipo (round fluffy
golden yellow bird, green leaf tuft, red scarf) in a woven nest between two cream
cottages (green and terracotta roofs), daisies and olive leaves; a single cream
cottage with green shingles, arched wood door and round attic window; an open
cream envelope containing a gold invitation card with a small embossed house,
daisies and olive leaves. Shared suffix: “Cozy hand painted watercolor storybook
with softly sculpted details, warm cream sage olive and honey gold palette.
Exact visual style of the attached Ninho screen. Isolated complete objects with
generous transparent margins. No lettering no UI no frames no watermark.”

Validation: lint and TypeScript passed in both apps; Next production build
passed; Expo exports for Android and iOS passed. Direct artwork inspection passed. Full browser screenshot acceptance,
real-device layout/accessibility, and account sign-out interaction remain pending.

## Create residence refinement — 2026-10-26

Reference: `image(20261026-192714).png`. Refined `/criar-residencia` in
Next.js and Expo: desktop story/form columns, compact mobile hero, native
currency/timezone picker, keyboard-friendly scrolling, explanatory field text,
and a real return action instead of a shortcut that skipped creation.

The dedicated existing artwork was inspected against the reference and retained:
`frontend/public/images/pipo-create-residence-desktop.webp`,
`frontend/public/images/pipo-create-residence-mobile.webp`, and
`mobile/assets/pipo-create-residence-mobile.webp`. No new image was necessary.
Both routes now use the existing session restoration gate. Sign-out calls the
identity service, disables editing while pending and reports safe failures.
The form name limit now matches `HouseholdRules.NormalizeName` (80 characters)
and rejects whitespace-only names. The backend domain remains authoritative.
Following Clean Architecture chapter 23, UI changes remain in presentation;
no persistence/domain behavior was introduced in components.

Scope: the submit action still explicitly reports that no residence was saved.
The existing backend creation request accepts only `Name`; persistence for the
currency and timezone shown in this mockup is not implemented. These settings
must be added across the domain, application, database and API before claiming
this is an integrated creation flow. The old preview bypass to account setup was
removed so submission cannot silently advance without a saved residence.

Checks: lint, TypeScript, formatting, Next production build and Expo Android/iOS
export. Artwork inspected directly; browser screenshot acceptance, screen-reader
and physical-device interaction remain pending.

## Invitation code and review refinement — 2026-10-26

Reference: `image(20261026-193338).png`. Refined the existing two-step
`/entrar-convite` screen in Next.js and Expo. Both entry routes now use the
session restoration gate. The desktop layout retains the large scene and form;
mobile uses a compact transparent hero for each step. Existing dedicated assets
were inspected and retained: `pipo-invite-code-desktop.webp`,
`pipo-invite-review-desktop.webp` in `frontend/public/images/`, plus
`pipo-invite-code-mobile.webp` and `pipo-invite-review-mobile.webp` in both
`frontend/public/images/` and `mobile/assets/`. No new generation was needed.

Web moves focus to the review heading when advancing and returns focus to the
code input when going back; validation is associated with the input. Native
rejects blank input, dismisses the keyboard on verification, and scrolls to the
top when changing steps. Back preserves the entered code; cancel returns to the
choice screen. Demo instructions are in an expandable web disclosure; native
retains an explicit preview notice. Confirmation navigates only to the existing
demo result and does not mutate membership. The financial privacy statement
is design copy, not evidence of backend authorization testing.

Scope: all invitation data and codes on this screen remain demonstrative.
The existing backend has an acceptance operation but no invitation-preview
operation to return the permitted residence/inviter context before acceptance.
Implementing that application/domain/infrastructure boundary and connecting the
clients is separate work. The present screen does not send codes to the server,
store them in URLs, or fetch financial information. Clean Architecture chapter 23
continues to guide the presentation boundary. React best-practices review:
static assets, semantic navigation, no added data subscriptions or dependencies;
the web focus effect depends only on a step transition.

Validation: formatting, lint and TypeScript in both clients; Next production
build and Expo Android/iOS exports. Artwork inspected directly. Rendered browser
screenshots, screen-reader/device testing and live invitation operations remain
pending.

## Invitation result screens — 2026-10-26

Reference: `image(20261026-195341).png`. Refined accepted, expired, invalid
and already-used invitation results in Next.js and Expo. Each state retains its
own existing illustration, inspected directly against the reference:
`frontend/public/images/pipo-invite-{accepted,expired,invalid,used}.webp` and
identical native assets in `mobile/assets/`. No new artwork was needed.

Updated the responsive artwork proportions, centered copy and action spacing,
cream backdrop and keyboard focus visibility. Removed the demo-state navigation
from the result UI. Hidden empty status containers avoid reserved blank space;
notices still announce unavailable residence access. All eight result route
entries now use the existing authentication gate. State-specific component keys
isolate notices between results. Expired/invalid return to code entry; secondary
actions return to the choice screen or code entry as appropriate.

The accepted result remains fictitious, as stated on screen. No invitation is
accepted and no membership is created by opening a result URL. The accepted/used
primary actions still announce that residence access is unavailable; there is
no implemented residence listing/dashboard in these React clients. No financial
queries or backend changes were introduced. Clean Architecture chapter 23 guides
keeping these views separate from membership use cases.

Validation: formatting, lint, TypeScript, Next production build, and Expo
Android/iOS exports. Direct artwork inspection completed. Rendered screenshot
acceptance, screen-reader/device interaction and live invitation verification
remain pending.

## First financial account refinement — 2026-10-26

Reference: `image(20261026-200022).png`. Updated initial configuration and
account-ready screens for Next.js and Expo. Both routes now use the existing
session gate. Inspected and retained dedicated `pipo-first-account-desktop.webp`,
`pipo-first-account-mobile.webp` and `pipo-first-account-success.webp` assets in
`frontend/public/images/`, with native mobile/success versions in `mobile/assets/`.
No new generation was necessary.

Web preserves form values when returning from the ready preview, focuses the
ready heading and initializes the date after hydration using the client local
calendar (rather than UTC). The currency prefix reflects the selected currency.
The name length matches the backend account domain limit of 80 characters.
Native now uses a compact currency selector with an accessible radio modal,
selection/cancel/system-back handling. Edits clear stale notices. Verification
rejects invalid dates and amounts, closes the keyboard and scrolls to the ready
view. Existing native state preserves drafts on review. Negative initial balances
remain allowed. The balance explanation distinguishes opening balance from income.

Following Clean Architecture chapter 23, these changes concern presentation;
financial rules remain in the existing backend domain. Submission is still an
explicit UI preview: no account, opening balance or transaction is saved. Ready
copy does not establish persistence, and transaction actions report unavailable
forms. The household/API integration and destination dashboard remain separate
work. The existing skip action returns to the current choice screen.

Validation: formatting, lint and TypeScript, Next production build and Expo
Android/iOS exports. Direct artwork inspection completed. Rendered browser
screenshots, device modal/keyboard/screen-reader testing and live financial
operations remain pending.

## Financial home dashboard — 2026-10-26

Reference: `image(20261026-202739).png`. Added authenticated `/inicio` routes
for Next.js and Expo. Desktop has a sidebar, residence context, month selector,
separate currency balances, summary cards, paired income/expense bars, recent
transactions and quick actions. Narrow web/native use a compact hero, stacked
summary and bottom navigation. Initial account skip/home links now reach this
screen; they do not create an account. Unimplemented navigation/actions report
an unavailable notice rather than perform financial mutations.

The dashboard is explicitly a fixture preview. Month (May–October 2026) and
currency (BRL/USD) change the period summary, history and transaction sample.
Balances are labeled current examples and remain independent of the selected
period. Monetary fixture values use integer cents; each currency is formatted
separately with no conversion or cross-currency total. Transfers are labeled
outside the period result. Transactions are a sample, explicitly not the sum
of the period totals. No backend dashboard, membership or financial API call is
made. `frontend/lib/dashboard/demo.ts` and `mobile/src/data/dashboard-demo.ts`
contain identical deterministic fixtures, isolated from the views. Replace
these at the application boundary during real dashboard integration. Clean
Architecture chapter 23 guided keeping the views separate from data preparation.

Accessibility: labeled month/currency controls and active states, readable
amounts, text legends, web table disclosure and native text values for the chart,
modal cancellation/system-back handling, and polite notices. Native month and
web currency controls retain minimum touch targets. Full visual/device and
screen-reader acceptance remain pending; no screenshot acceptance is claimed.
Reviewed with React best practices: statically resolved native assets, derived
summary without effects, no new dependencies or provider subscriptions.

New art generated with the built-in image generator and inspected directly:
`frontend/public/images/pipo-dashboard-hero.webp` and
`mobile/assets/pipo-dashboard-hero.webp` (identical 1000×500 RGBA WebP).
Prompt: “Use case: illustration-story. Production Ninho finance dashboard hero
transparent cutout. A small cheerful round golden yellow fluffy bird Pipo,
green leaf tuft, orange beak, warm rust red scarf, smiling eyes closed, wings
relaxed open, standing between small olive leaf branches and a few white daisies.
Cozy watercolor storybook with softly sculpted warm textures, olive sage cream
honey palette. Landscape 2:1 composition with complete silhouette and generous
transparent margin. No house, no wallet, no coins, no text, no UI, no watermark.
Welcoming calm dashboard companion.”

Validation: formatting, lint and TypeScript in both apps; Next production build
(25 routes); Expo Android/iOS exports. Live household isolation, authorization,
dashboard reconciliation and financial data are not exercised by this preview.

## Financial home backend integration — 2026-10-26

Supersedes the fixture-data portion of the earlier dashboard entry. Both clients
now load memberships, dashboard summaries and ledger history from ASP.NET using
the current Supabase session token. Removed both dashboard demo source files.
Added shared `@inout/finance` adapter/store with cancellation, stale response
isolation, timeout and safe error/empty states. Currency and period controls
use server memberships/currencies and calendar periods. Balances explicitly use
the backend period end. Graphs use server period totals; negative adjustments
fall back to signed values. Recent ledger entries retain each entry's currency.
The existing dashboard illustration is unchanged.

See `docs/react-financial-home.md` for endpoints, configuration, security and
verification details. Tests use controlled HTTP responses only; runtime screens
have no mocked fallback. Live API/browser/device validation remains pending
because the API/.NET runtime was unavailable in the execution environment.

## Period selection dialog and sheet — 2026-10-26

Reference: `image(20261026-210700).png`. Added a desktop/narrow-web dialog and
native bottom sheet with four presets, calendar month navigation, Monday-first
day grid, inclusive range highlighting, editable initial/final dates, range
summary, cancel/close and apply. Web supports direct month selection; native
supports month arrows and typed calendar dates. Presets use complete months.
The draft is isolated from the active filter: only Apply invokes the store.
The selector remains available in empty states. Escape and Android system-back
close the modal; web uses the browser dialog focus boundary.

Extended the existing finance adapter to call the backend's `from`/`to`
capabilities for custom ranges. Monthly requests keep the six-month graph;
custom ranges display the server's exact range aggregate as one graph entry,
not a sum including dates outside the selection. Both summary and recent
history use the same inclusive bounds. Validation covers real dates, ordering,
leap years, a single day and year transitions. No backend schema/API changes
or mocked production data were introduced. Domain `FinancialPeriod` and Clean
Architecture chapter 23 informed the application/presentation separation.

New illustration, generated with the built-in image generator and inspected:
`frontend/public/images/pipo-period.webp`, `mobile/assets/pipo-period.webp`
(identical 600×450 RGBA WebP). Prompt: “Use case illustration-story. Small
transparent production UI illustration for Ninho period selection dialog:
Pipo round fluffy golden yellow bird, green leaf tuft, orange beak and warm
rust red scarf, holding a little cream monthly calendar with green squares
and one terracotta circled day; a few olive leaves and white daisies at feet.
Cozy watercolor storybook softly sculpted warm texture, sage cream honey palette.
Entire character and calendar visible, landscape 1.5:1, generous transparent
margins. No letters, no numbers, no UI, no watermark. Friendly focused expression.”

Verification: 52 web/shared tests passed, including four new period tests;
formatting, lint, TypeScript and Next/Expo Android/iOS production builds passed.
Clean dependency installs checked the shared package. Artwork inspected directly.
Live API data and browser/device keyboard, modal-focus and screenshot acceptance
remain pending; no API or .NET runtime was available in this environment.

## Balance composition — 2026-10-26

Reference: `image(20261026-214325).png`. Added authenticated web/native
`/composicao-saldo`, connected to real API responses through `@inout/finance`.
Dashboard cards navigate with household, period and currency. Returning restores
those parameters; direct links validate membership before loading a ledger.
Composition includes currency tabs, signed total, hide/show, account distribution,
account list, per-account details and navigation to other currencies. Desktop
uses a table; native uses compact account rows. Account details show selected-date
balance plus credits, debits and net change supplied by the dashboard endpoint.
The metadata accounts endpoint adds kind labels without replacing period balances.
No fictitious accounts, balances or types are introduced.

BigInt sum checks compare account balances to the consolidated API total. The
legend uses net percentages (undefined at zero net). The bar uses explicitly
labeled absolute weights with negative balances orange. Mismatches and backend
reconciliation failures display an alert. Hide-values masks all displayed amounts
and hides distribution/percentages. Web detail changes move focus to the heading;
native scrolls to the top. Live API/device/browser acceptance remains pending.

The existing domain/application dashboard contract and Clean Architecture chapter
23 guide the boundary: totals and account activity come from .NET; the shared
client package prepares display composition. Added tests cover signed balances,
currency isolation, zero net, mismatch detection, large integer cents, snapshot
balance versus current metadata, and membership validation of direct links.
Validation: 56 shared/web tests, formatting, lint, TypeScript and production
Next/Expo Android/iOS builds. Screenshots and live financial operations were not
verified in this environment; no API/.NET runtime was available.

New header art generated with the built-in image generator, inspected directly,
then encoded as identical 1000×500 RGBA WebP copies:
`frontend/public/images/pipo-balance-composition.webp` and
`mobile/assets/pipo-balance-composition.webp`.
Prompt: “Use case illustration-story. Transparent landscape header asset for
Ninho household finance balance composition screen. Pipo small round fluffy
golden yellow bird, green leaf tuft, orange beak, rust red scarf, leaning
attentively over an open cream accounting notebook on a small warm wood surface,
two small stacks of golden coins at right, little potted olive green plants and
white daisies. Warm cozy watercolor storybook with softly sculpted details, sage
cream honey palette. Wide 2:1 composition, complete character and notebook,
generous transparent margin. No legible letters, numbers, UI, logo, watermark.
Calm thoughtful friendly expression.”

## Income details

The income screen uses a new dedicated Pipo illustration, generated and visually
inspected, with identical transparent WebP assets at
`frontend/public/images/pipo-income.webp` and `mobile/assets/pipo-income.webp`.
Prompt: “Transparent Ninho income-detail UI header illustration: Pipo, a round
fluffy golden-yellow bird with green leaf tuft and rust red scarf, happily holding
a cream envelope, with two more closed envelopes and small stacks of gold coins
among olive branches and white flowers. Cozy warm watercolor storybook with
softly sculpted detail, sage green cream honey palette. Wide landscape 2:1
composition; complete bird and objects, transparent surrounding space. No
letters, numbers, UI, logo or watermark.”

Shared tests exercise real API contracts, signed reversals, pagination snapshot
changes and revoked access. The backend adds tests for membership and consistency
with dashboard totals. Backend tests and live API integration could not be run in
this environment because the .NET SDK is unavailable.

## Expense details

A dedicated illustration was generated using the built-in image generator and
saved as `frontend/public/images/pipo-expense.webp` and
`mobile/assets/pipo-expense.webp`. Prompt: “Transparent wide 2:1 UI header
illustration for Ninho expenses: Pipo, small fluffy golden yellow bird with leaf
tuft, orange beak and rust red scarf, thoughtfully organizing bills and receipts
beside a wicker basket, plants and a red mug, as in a cozy household finance app.
Warm watercolor storybook, sage, cream and honey palette. Complete character and
props, generous transparent space, no text, logos, interface or watermark.”

Client tests cover the expense endpoint, signed reversals and the empty period.
The .NET tests include membership and comparison with dashboard expense totals;
they could not be run here because the .NET SDK is unavailable.

## Result details

Dedicated Pipo art was generated with the built-in image generator, inspected,
and saved to `frontend/public/images/pipo-result.webp` and
`mobile/assets/pipo-result.webp`. Prompt: “Transparent landscape 2:1 UI header
illustration for Ninho household finance result screen: Pipo, a fluffy round
golden yellow bird with green leaf tuft, orange beak and rust red scarf,
thoughtfully comparing a little balance scale, with open notebook, coins and
leafy plants. Cozy warm watercolor storybook, sage green, cream, honey palette.
Complete bird and props, transparent surrounding space. No text, logos,
interface or watermark.”

## Category summary

A dedicated illustration was generated with the built-in image generator and
saved as `frontend/public/images/pipo-category.webp` and
`mobile/assets/pipo-category.webp`. Prompt: “Transparent wide 2:1 header asset
for a cozy Ninho household finance category summary: Pipo, a round fluffy
golden-yellow bird with green leaf tuft, orange beak and rust red scarf,
carefully organizing several wicker baskets of household items with leafy
plants. Warm watercolor storybook, sage green, cream and honey colors, charming
soft detail. Full character and baskets with transparent surrounding space. No
words, letters, numbers, UI, logo or watermark.”

The .NET test for the expense category identifier could not be run here because
the .NET SDK is unavailable. The financial endpoints must be deployed with the
client because the expense response now carries the category identifier.

## Income source summary

A dedicated Pipo illustration was generated using the built-in image tool,
inspected and saved at `frontend/public/images/pipo-income-sources.webp` and
`mobile/assets/pipo-income-sources.webp`. Prompt: “Transparent wide landscape 2:1
header illustration for Ninho household income source summary. Pipo, round
fluffy golden yellow bird with green leaf tuft, orange beak and rust red scarf,
gently watering three small leafy plants with golden coins blooming like flowers,
a green watering can in his wing. Cozy warm watercolor storybook, sage, cream,
honey colors. Complete character and plants, generous transparent surrounding
space. No text, lettering, numbers, UI, logo or watermark.”

Shared client tests cover full source totals on a partial page, equal source
names with distinct IDs, zero-net groups, source identities and inconsistent
amounts/counts. The backend tests cover grouping before pagination, unassigned
income and a fully reversed source. The .NET tests and live API integration were
not run because the environment has no .NET SDK. Native build export remains
pending the earlier approval block; no external Expo build was requested.

## New record chooser and forms

New-record artwork generated with the built-in image generator and inspected:
`frontend/public/images/pipo-new-record.webp` and
`mobile/assets/pipo-new-record.webp`. Prompt: “Transparent wide 2:1 header
illustration for Ninho new financial record dialog. Pipo, a cute round fluffy
golden-yellow bird with green leaf tuft, orange beak and rust-red scarf, happily
holding a large yellow pencil beside an open cream notebook, tiny green
Ninho-style house mug and leafy plant. Cozy warm watercolor storybook, sage
green, cream and honey colors. Full character and objects, transparent
surrounding space. No text, letters, numbers, logos, UI or watermark.”

Client verification includes exact-cent parsing, account/currency/flow checks,
authorization before option queries, POST paths and idempotency headers, no write
on loading, durable-before-send behavior, uncertain-response replay, restored
pending drafts, suppressed double-submit, ignored late responses, denied writes
and expired pending operations. Requests in tests use in-process fake HTTP
responses; no real financial records were created. Live .NET writes were not
exercised in this environment. Native export remains pending the earlier
approval block; no cloud Expo build was invoked.

## Dashboard setup states

Two dedicated built-in image-generator assets were inspected and saved for web
and native:
`frontend/public/images/pipo-empty-accounts.webp`,
`mobile/assets/pipo-empty-accounts.webp`,
`frontend/public/images/pipo-first-movement.webp` and
`mobile/assets/pipo-first-movement.webp`.

Prompt 1: “Transparent landscape 2:1 hero for Ninho household finance empty
accounts state: Pipo, round fluffy golden-yellow bird with green leaf tuft,
orange beak, rust-red scarf, carefully building a small empty nest of twigs
beside a large blank spiral notebook and a potted sapling. Warm cozy watercolor
storybook, sage, cream, honey palette. Full bird, nest and notebook, generous
transparent space. No text, numbers, lettering, logos or UI.”

Prompt 2: “Transparent landscape 2:1 hero for Ninho household finance ready for
first transaction state: Pipo, round fluffy golden-yellow bird with green leaf
tuft, orange beak, rust-red scarf, proudly holding a blank notebook and a pencil
beside a small cream cottage with terracotta roof, leafy garden and flowers.
Cozy warm watercolor storybook, sage green, cream and honey palette. Full
character and cottage with generous transparent margin. No text, numbers,
lettering, logos or UI.”

Client tests verify explicit lifetime activity versus an empty period, opening
balances, unknown metadata, reconciliation failures, initial versus current
balances, signed initial cents and stable account IDs/keys after uncertain writes.
The existing transaction tests also cover the shared submission lifecycle after
its refactor. Tests use fake HTTP responses, and no real accounts or transactions
were created. The .NET SDK is unavailable, so the new reader projection and API
tests still require backend build/integration validation. Native exports remain
pending the previously reported approval block.

## Histórico de lançamentos — 2026-10-28

- Rotas autenticadas `/lancamentos` no web e Expo; navegação pelo dashboard, incluindo estados iniciais. Busca por descrição, período mensal ou intervalo, conta e tipo; paginação em servidor; lista vazia, erro com retry e carregamento explícitos.
- Transferências preservam movimentos por conta. Originais estornados têm valor riscado e situação própria; detalhes incluem ID, moeda e referência ao original. Sem dados demonstrativos ou operações financeiras durante validação.
- Testes compartilhados: limites inclusivos, busca escapada, offset e lookahead; moedas distintas, pernas de transferência, referência de estorno, autorização, vazio e rejeição de valores/direções inválidos. 47 testes financeiros passaram; 86 testes no comando web e 79 no mobile. Formatação, lint e tipagem de ambos passaram.
- Build de produção Next.js passou com a rota `/lancamentos`. O primeiro build encontrou cache Turbopack inválido; o build passou após remover somente `.next`.
- Teste EF existente ampliado para verificar segunda perna da transferência com offset e página esgotada. Não executado: SDK .NET/Postgres indisponíveis. Integração real, QA visual no dispositivo e exports nativos não executados.
- Arte criada com ferramenta imagegen integrada, inspecionada e salva em `frontend/public/images/pipo-history.webp` e `mobile/assets/pipo-history.webp`.
- Prompt final: “Use case: illustration-story. Transparent landscape hero illustration for Ninho financial transaction history. Pipo, round fluffy golden-yellow bird, green leaf tuft, orange beak and rust-red scarf, examining an open accounting book with a magnifying glass, beside small stacks of books and potted leafy plants. Cozy watercolor storybook, cream sage honey palette. Whole scene isolated, generous transparent margins. No text, numbers, logos or UI.”

## Logo Ninho — 2026-10-28

Marca própria criada com imagegen integrado: casinha sobre ninho, folha discreta, telhado terracota e nome em verde profundo. Fonte PNG RGBA preservada em `frontend/public/images/ninho-logo.png` e `mobile/assets/ninho-logo.png`, idênticas entre plataformas.

`BrandLogo` centraliza a marca nas duas plataformas. Versão completa nos cabeçalhos de acesso, onboarding e barras laterais financeiras; versão compacta no seletor de residência do dashboard mobile. O símbolo compacto é uma janela de apresentação sobre a mesma imagem, sem redesenhar ou regenerar a marca. Texto alternativo/nome acessível: Ninho. Links e contexto de navegação existentes preservados. Ícones decorativos de plantas fora da marca foram mantidos.

Prompt: “Create the final primary logo for Ninho, a cozy household finance app. Transparent background, wide horizontal logo lockup. At left a simple warm terracotta pitched roof outlining a small cream house resting directly on a stylized nest of three broad curved brown strokes, tiny sage leaf accent. No bird, no coin, no heart, no detailed twigs. At right exact word 'Ninho' in beautiful highly legible dark forest green serif lettering. Flat clean brand illustration with subtle organic curves, crisp edges, minimal shapes, professional scalable appearance, no shadows, no gradients, no watercolor texture. House-nest symbol should read clearly at small app sizes. Generous clear transparent margin around logo. Only text is 'Ninho'. No tagline, no mockup.”

Validação do logo: lint e tipagem web/mobile passaram; build de produção Next.js passou. Arte gerada inspecionada visualmente. Sem testes novos para a substituição visual; QA em dispositivo e builds nativos não executados.

## Busca e filtros — 2026-10-28

Painel de referência implementado no histórico web/mobile: texto por descrição, datas inclusivas, tipos, conta, categoria/subcategoria, fonte apenas para entradas, pílulas removíveis e botões Limpar/Aplicar. Fechar não aplica o draft. O web usa dialog modal com foco nativo e fechamento por Escape; o mobile usa Modal com botão Fechar e retorno do sistema. Datas no Expo usam campos DD/MM/AAAA com validação real do calendário.

Testes financeiros adicionados cobrem restauração da hierarquia, imutabilidade do filtro aplicado, intervalo inválido, descarte de fonte incompatível, encaminhamento dos parâmetros e catálogos históricos após autorização. Teste EF de categorias arquivadas ampliado para distinguir categoria exata de categoria com filhos; não executado por ausência de SDK .NET e banco de integração. Lint, formatação, tipagem web/mobile e build Next.js passaram. Sem operações financeiras reais, QA de dispositivo ou exports nativos.

Ilustração criada com imagegen integrado e inspecionada, salva em `frontend/public/images/pipo-filters.webp` e `mobile/assets/pipo-filters.webp`.

Prompt final: “Transparent horizontal watercolor storybook hero for Ninho household finance search and filters panel. Pipo, a small fluffy golden-yellow bird with green leaf tuft, orange beak and rust-red scarf, holding a magnifying glass beside three neat blank index-card dividers and small sage leafy potted plants. Warm cream honey terracotta sage palette, airy gentle composition, full character, transparent margins. No words, letters, numbers, labels, logos or UI.”

## Nova entrada — 2026-10-28

Formulário existente ajustado à nova referência, com navegação para Lançamentos, logo compartilhado e barra lateral no desktop, cabeçalho ilustrado próprio, conta de destino obrigatória, moeda somente leitura derivada da conta, valor, categoria obrigatória, fonte opcional, data e descrição com contador de 500 caracteres. Web em duas colunas responsivas; mobile com cabeçalho compacto e data DD/MM/AAAA convertida ao formato ISO para o mesmo contrato do backend. Valores do exemplo não são preenchidos como dados reais.

O POST de entrada e as proteções existentes de identidade, autorização, centavos inteiros, categoria de entrada, persistência da tentativa, chave idempotente e retry incerto foram mantidos. Cancelar apenas navega, sem POST; durante envio está bloqueado. Uma tentativa incerta continua persistida e a ação é apresentada como Voltar aos lançamentos. O sucesso só aparece após confirmação do backend.

Validação: 90 testes web (incluindo os testes compartilhados financeiros e identidade), lint e tipagem nas duas plataformas passaram. Sem escrita financeira real, teste de integração .NET ou execução em dispositivo; builds nativos não executados.

Arte criada com imagegen integrado, inspecionada e preparada em WebP com transparência para `frontend/public/images/pipo-income-form.webp` e `mobile/assets/pipo-income-form.webp`.

Prompt final: “Transparent wide watercolor storybook hero for Ninho household finance NEW INCOME form. Pipo a fluffy golden yellow bird with green leaf tuft, orange beak and rust red scarf, smiling with closed eyes while gently dropping one golden coin into a small dark sage green purse with a leaf emblem. Blank notebook beside purse and small potted sage plant. Warm cream honey terracotta palette, cozy gentle light, whole character and objects, generous transparent margin. No letters, words, numbers, logos or UI.”

Build de produção Next.js da atualização Nova entrada também passou.

## Nova saída — 2026-10-28

Referência de Nova saída aplicada no web e mobile, usando a estrutura compartilhada de movimentações: conta de origem, moeda vinculada à conta e somente leitura, valor com destaque terracota, categoria, subcategoria opcional, data, descrição com contador, Cancelar e Registrar saída. Layout desktop com barra lateral e duas colunas, e layout mobile em sequência. Ilustração exclusiva de compras; sem preencher os valores demonstrativos do mockup.

O catálogo ativo de criação agora preserva `parentId` quando presente. A seleção da categoria mostra raízes; selecionar uma subcategoria envia seu ID no mesmo `categoryId` do contrato de despesa existente. Trocar categoria descarta a seleção anterior de subcategoria. Usar apenas a categoria continua permitido pelo backend. Fonte de renda não aparece para despesa. O POST autenticado de `/expenses`, validações de centavos e fluxo, proteção idempotente e recuperação de tentativa incerta foram mantidos.

Validação: formatação, lint e tipagem de web/mobile passaram; suíte web com 90 testes e mobile com 83 passou antes da adição do novo teste de hierarquia. Os 11 testes de gravação, incluindo o novo teste que verifica hierarquia e ID da subcategoria no contrato de despesa, também passaram. Sem escrita financeira real, integração .NET, QA em dispositivo ou build nativo.

Arte gerada com imagegen integrado, inspecionada e preparada com transparência em `frontend/public/images/pipo-expense-form.webp` e `mobile/assets/pipo-expense-form.webp`.

Prompt final: “Transparent wide watercolor storybook hero for Ninho household finance NEW EXPENSE form. Pipo, fluffy golden yellow bird, green leaf tuft, orange beak and rust red scarf, carefully checking a blank shopping receipt beside a wicker basket of carrots, green vegetables and bread, small blank notebook on table. Cozy warm cream sage terracotta palette, whole character and objects with generous transparent margins. No letters numbers text logos or UI.”

Build de produção Next.js da atualização Nova saída passou.

## Nova transferência — 2026-10-28

Referência implementada no formulário compartilhado de web e mobile: origem e destino distintos, moeda somente leitura, valor, data, descrição, lista de contas indisponíveis com razões explícitas (mesma origem ou moeda incompatível), aviso de exclusão do resultado e ação Registrar transferência. Desktop usa barra lateral e formulário em colunas; mobile apresenta a ilustração da ponte acima dos campos e uma seta entre as contas. Não há campos de categoria ou fonte em transferência.

Mantido o contrato existente de POST `/transfers`, com autorização, centavos inteiros, mesma moeda, chave idempotente e tentativa durável. Mudar origem continua limpando o destino. A tela não apresenta conversão cambial e não oferece contas incompatíveis como destinos selecionáveis. Descrição mantém o limite de 500 caracteres aceito pelo contrato existente. Cancelar não envia operação, e fica bloqueado durante envio; pendências incertas permanecem recuperáveis.

Validação: 91 testes web, 84 mobile, formatação, lint, tipagem de ambas plataformas e build de produção Next.js passaram. Sem transferência real durante testes, integração .NET, QA em dispositivo ou export nativo.

Arte própria criada com imagegen integrado e inspecionada, preparada em `frontend/public/images/pipo-transfer-form.webp` e `mobile/assets/pipo-transfer-form.webp`.

Prompt final: “Transparent wide watercolor storybook hero for Ninho household finance internal TRANSFER form. Pipo fluffy golden yellow bird with green leaf tuft orange beak rust red scarf, smiling while carrying one golden coin across a small wooden rope bridge between two dark sage green purses decorated with simple leaf emblems. Gentle leafy plants at both ends. Cozy cream honey terracotta sage palette, full bridge character and both purses, generous transparent margins. No text letters numbers logos or UI.”

## Seletores auxiliares — 2026-10-28

Implementados seletores com busca e item selecionado para conta, categoria, subcategoria e fonte nos formulários web/mobile. Subcategoria mostra o contexto da categoria, fonte inclui Sem fonte, e destinos incompatíveis de transferência ficam desabilitados. Calendário de data com Hoje/Confirmar e fechamento sem aplicar. Componentes próprios nas duas plataformas, usando os helpers de domínio compartilhados, sem dependências novas ou novas imagens.

Criação inline de conta com saldo inicial zero, categoria, subcategoria e fonte pelos endpoints reais existentes. A tentativa é persistida antes do envio, com namespace próprio por ator/residência/tipo/contexto; confirmação explícita antes de usar o item. Fonte recupera uma resposta incerta por UUID e correspondência do item. Atualização do catálogo preserva os campos da movimentação e a conta selecionada.

Validação: 97 testes web e 90 mobile passaram; formatação, lint e tipagem de ambas plataformas e build Next.js passaram. Os seis testes novos cobrem busca com acentos, calendário bissexto e virada de ano, tentativa durável com ID/chave estáveis, pai incompatível, saldo inicial zero, resposta perdida de fonte sem POST duplicado e preservação do lançamento ao atualizar opções. Sem criação real de registros na validação. Integração .NET/Postgres, QA visual no navegador/dispositivo e exports nativos não executados.

## Revise seu lançamento — 2026-10-28

Tela de revisão implementada nos formulários web e mobile, com valor real, resumo de conta/moeda/classificação/data/descrição, edição dos dados preservados, aviso antes de confirmar e ação de confirmação. Aplicável a saída, entrada e transferência; a saída usa o destaque terracota da referência. Antes de confirmar, o status é Ainda não registrado; em operação incerta é Confirmação pendente, com verificação pela mesma chave. Envio em andamento bloqueia confirmação duplicada. Sucesso só aparece após resposta confirmada do backend.

Testes compartilhados novos: resumo de despesa com categoria/subcategoria e descrição normalizada; receita e transferência com seus campos próprios; rejeição de valores/categorias/contas inválidos; revisão e edição sem persistência nem POST; confirmação explícita com os valores revisados. A suíte web passou com 101 testes e o build Next.js passou. Sem lançamento financeiro real, integração .NET/Postgres ou QA visual em navegador/dispositivo. Exports nativos não executados.

Arte própria criada com imagegen integrado e inspecionada, preparada com transparência em `frontend/public/images/pipo-review.webp` e `mobile/assets/pipo-review.webp`.

Prompt final: “Transparent wide watercolor storybook hero for Ninho household finance REVIEW BEFORE CONFIRMATION screen. Pipo, fluffy golden-yellow bird with green leaf tuft, orange beak and rust-red scarf, carefully reviewing a blank notebook checklist with a pencil, beside a cream mug and small sage leafy plant. Warm cream honey terracotta sage palette, cozy attentive expression, whole character and objects, generous transparent margins. No words letters numbers logos or UI. A single simple green check mark on the notebook is allowed.”

Validação mobile concluída: 94 testes, formatação, lint e tipagem passaram. As mesmas verificações de código também passaram no web.

## Lançamento registrado — 2026-10-28

Tela de sucesso web/mobile implementada após confirmação real do backend, com arte exclusiva, resumo dos dados e ações Ver lançamento, Novo registro e Voltar ao histórico. Atende entrada, saída e transferência; saída mantém destaque terracota. O sucesso não é exibido para tentativas incertas ou erros. Valores demonstrativos do mockup não são preenchidos como dados reais.

Ver lançamento usa o UUID retornado pelo POST, com filtro de transação acrescentado ao endpoint/read model de histórico, dentro do escopo da residência autorizada. O cliente recusa resposta com UUID diferente. Transferências preservam ambas as movimentações; detalhes mobile incluem tipo, valor, data, classificação e situação. Novo registro abre uma instância nova do formulário mesmo ao escolher o mesmo tipo.

Validação: suíte web com 103 testes passou, incluindo consulta exata de transação e rejeição de filtro ignorado; o build Next.js passou após limpeza de cache Turbopack inválido. Formatação, lint e tipagem web/mobile passaram. Teste EF existente ampliado para consultar os dois movimentos da mesma transferência por UUID e verificar UUID inexistente, mas não executado por ausência do SDK .NET/Postgres. Sem lançamento real, integração real, QA visual no navegador/dispositivo ou build nativo.

Arte criada com imagegen integrado, inspecionada e preparada em `frontend/public/images/pipo-saved.webp` e `mobile/assets/pipo-saved.webp`.

Prompt final: “Transparent wide watercolor storybook hero for Ninho household finance RECORD SAVED success screen. Pipo, fluffy golden-yellow bird with green leaf tuft, orange beak and rust-red scarf, smiling proudly while stamping an open blank notebook with one simple green checkmark. Gentle leafy branches frame both sides. Warm cream honey terracotta sage palette, cozy joyful mood, whole character and notebook, generous transparent margins. No text letters numbers logos or UI.”

Validação mobile final: 96 testes, lint e tipagem passaram.

## Detalhe do lançamento e estorno — 2026-10-28

Implementada rota de detalhe autenticada no web/mobile, ligada aos itens do histórico e ao botão Ver lançamento da tela de sucesso. Consulta por UUID sem depender do período, com valor assinado, conta(s), moeda, categoria/subcategoria, fonte quando presente, data, descrição, situação e auditoria reais. Estornos têm vínculo para o original; após um estorno confirmado é possível abrir a compensação retornada.

Confirmação explícita de estorno com data e descrição, pelo POST .NET existente. Nada é estornado ao abrir o detalhe, editar ou fechar o painel. Tentativa durável por ator/residência/transação, chave estável em retry e retomada, campos bloqueados enquanto o resultado é incerto, sucesso somente confirmado pelo backend. Ação bloqueada para registro já estornado e para estorno de estorno. O original nunca é excluído.

A API expõe o UUID do autor, não um nome auditável; a interface informa o usuário pelo ID. O horário exibido é PostedAt, rotulado Registrado em com indicação do fuso do dispositivo. Sem nomes, IDs curtos ou horários demonstrativos do mockup.

Validação: 109 testes web, 102 mobile, formatação, lint e tipagem das duas plataformas, além do build Next.js, passaram. Os seis testes novos verificam UUID/autorização e ausência de filtro de período; auditoria e classificação; transferências com ambas as contas; contrato e cabeçalho do POST; persistência da tentativa antes do POST, após a confirmação explícita, com replay da mesma chave, mesmo após o original aparecer estornado; bloqueio de estorno novo em operações inelegíveis. Nenhum estorno real foi realizado. SDK .NET/integração Postgres, QA visual no navegador/dispositivo e builds nativos não executados.

Arte própria criada com imagegen integrado e inspecionada, preparada com transparência em `frontend/public/images/pipo-detail.webp` e `mobile/assets/pipo-detail.webp`.

Prompt final: “Transparent wide watercolor storybook hero for Ninho household finance transaction DETAIL screen. Pipo fluffy golden-yellow bird with green leaf tuft orange beak rust-red scarf wearing small round reading glasses, thoughtfully examining a blank receipt beside an open notebook, a cream mug with tiny leaf motif and sage potted plant. Cozy warm cream honey sage terracotta palette. Full character and objects with generous transparent margins. No letters words numbers logos or UI.”

## Transfer detail — 2026-10-28

- The existing authenticated `/lancamento?household=…&transaction=…` route now renders a dedicated transfer layout in web and mobile, automatically selected from the real API kind. History and saved-transfer links already reach this route.
- Origin and destination are taken from signed postings, not response order. Responsive account cards, currency, occurrence date, description, real status and audit identifiers follow the supplied reference. The API still provides the actor UUID rather than a display name; no invented name or friendly transaction ID is shown.
- A transfer must contain exactly two opposite, balanced postings on different accounts; missing legs and duplicate accounts fail closed.
- “Estornar transferência” uses the existing durable confirmation flow and one idempotent .NET transaction reversal call. The original remains visible. The existing EF store saves both inverse entries and original status in a single database transaction. No new financial endpoint or mock data was introduced.
- Added shared regression coverage for reversed response order, missing/duplicate legs and duplicate confirmation producing one write. Added a .NET domain test for both inverse transfer entries; .NET execution is unavailable in this environment.
- Art created with the built-in image-generation tool, inspected and prepared as transparent WebP in `frontend/public/images/pipo-transfer-detail.webp` and `mobile/assets/pipo-transfer-detail.webp`. Prompt: “Wide transparent watercolor hero for Ninho transfer detail. Pipo a fluffy golden-yellow small bird with green leaf tuft, orange beak and rust-red scarf walks across a tiny arched wooden bridge carrying one gold coin. Sage-green coin pouch with house emblem on the left, terracotta pouch with family emblem on the right, soft leafy plants. Cozy hand-painted storybook watercolor, honey gold, sage, terracotta, warm cream, delicate paper texture. Full subject, generous transparent margins. No text, UI or watermark.”
- Browser/device visual acceptance and live .NET/database integration remain pending. No real financial operation was performed during verification.

- Transfer-detail verification: web 112/112 tests, mobile 105/105 tests, formatting, lint and TypeScript passed; Next production build passed after clearing corrupt local Turbopack cache. The new .NET domain test was not executed because the SDK is unavailable.

## Opening balance detail — 2026-10-28

- The authenticated canonical `/lancamento` route selects the opening-balance presentation from the actual API transaction kind in both clients. It displays the signed original position, the financial account and currency, reference date, persisted description, actual status and audit identifiers.
- The dedicated warning distinguishes the starting position from revenue, the period result and recurring transactions. Existing .NET dashboard rules already exclude opening balances from period results. No financial data is mocked or written by viewing the screen.
- “Ver conta” links to `/composicao-saldo` with household, currency, period and the posting's actual account ID. Both clients initialize the existing real account detail from that ID and report when it is absent from the selected composition, rather than displaying another account as the requested one.
- The reference has no new reversal action for an opening position, so this presentation exposes account/history navigation. An already persisted reversal attempt from an earlier UI remains recoverable with its original key and payload; pending operations are not discarded.
- Shared repository validation requires one posting for an opening balance. Regression tests cover positive/negative signed positions, reference-date labels and audit data, plus rejection of multiple postings.
- Audit remains the API user UUID and `PostedAt` labelled “Registrado em”, not an invented display name or creation timestamp. Device timezone is stated.
- Built-in image-generation tool created the dedicated illustration, inspected and prepared as transparent WebP in `frontend/public/images/pipo-opening-detail.webp` and `mobile/assets/pipo-opening-detail.webp`. Prompt: “Transparent watercolor illustration for Ninho opening account balance detail. Pipo fluffy small golden-yellow bird, green leaf tuft, orange beak, rust-red scarf, gently putting a single gold coin next to an open cream notebook recording the starting point of a household account. Sage leafy plants behind and a tiny wooden pencil. Cozy delicate hand-painted storybook watercolor, warm honey, sage, terracotta and cream, soft paper texture. Entire bird, notebook and coin visible, generous transparent margins, landscape composition. No words, letters, numbers, logos, UI or watermark.”
- Browser/device visual acceptance and live .NET/database integration remain pending. No financial write was performed during verification.

- Opening-detail verification: web 114/114 tests, mobile 107/107 tests, formatting, lint and TypeScript passed; Next production build passed. No native build, browser/device acceptance or live .NET integration was executed.
