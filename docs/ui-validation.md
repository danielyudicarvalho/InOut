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
