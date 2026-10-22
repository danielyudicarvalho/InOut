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
