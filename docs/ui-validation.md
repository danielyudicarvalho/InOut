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
