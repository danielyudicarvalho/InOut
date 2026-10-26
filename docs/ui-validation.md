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
