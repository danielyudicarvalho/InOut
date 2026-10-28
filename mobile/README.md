# InOut Mobile — UI

React Native + Expo SDK 58 + TypeScript, com tela de boas-vindas para Android/iOS. Node.js 22.13+ (recomendado Node 24 LTS).

```sh
cd mobile
npm ci
npm run android
# ou, no macOS com Xcode:
npm run ios
```

Para um aparelho físico, use um development build compatível com SDK 58; verifique a compatibilidade da versão instalada do Expo Go. Para gerar os projetos nativos e compilar localmente: `npx expo run:android` ou `npx expo run:ios` (macOS/Xcode). Android requer Android Studio/SDK para emulador ou build local.

```sh
npm run typecheck
npm run lint
npm run build:android
npm run build:ios
```

`expo export` valida os bundles JavaScript/assets; não gera APK/IPA nem substitui teste em dispositivo. `npm run web` é uma opção de inspeção, mas a versão web oficial está em `../frontend`.

`src/screens/WelcomeScreen.tsx` contém a tela; `src/theme.ts` contém os tokens visuais; `assets/pipo-home.webp` é a ilustração local. Safe area, rolagem, descrições acessíveis e fechamento do modal com o botão voltar do Android estão contemplados. Fontes são empacotadas localmente.

Login, cadastro e confirmação de e-mail usam Supabase Auth e Expo Router. Configuração, callbacks nativos, arquitetura e testes: [autenticação dos clientes React](../docs/auth-react-clients.md). Recuperação e redefinição de senha também estão integradas. Telas financeiras permanecem prévias.

## Code quality

Install the recommended VS Code ESLint and Prettier extensions for formatting on save.
Both apps share the root `.prettierrc.json` (2 spaces, 80-column wrapping).
ESLint checks Next.js/TypeScript or Expo/React Native conventions; Prettier handles formatting.

```sh
npm run format       # Format source files
npm run lint:fix     # Fix supported lint issues
npm run check        # Check formatting, lint (zero warnings), and TypeScript
```

GitHub Actions runs `npm run check` for both apps when UI code or quality configuration changes.
Generated files and dependency lockfiles are excluded from formatting.
