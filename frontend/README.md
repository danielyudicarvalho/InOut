# InOut Web — UI

Tela de boas-vindas em Next.js/React/TypeScript. Execute com Node.js 22.13+ (recomendado Node 24 LTS).

```sh
cd frontend
npm ci
npm run dev
```

Abra http://localhost:3000. Verificações: `npm run typecheck` e `npm run build`.

`app/` contém as rotas e CSS; `components/` contém a tela; `public/images/` contém a ilustração local do Pipo. Os textos são HTML acessível e os controles funcionam por teclado. Fontes Lora/DM Sans são carregadas do Google Fonts com fallback local.

Login, cadastro e confirmação de e-mail usam Supabase Auth. Configuração, arquitetura e testes: [autenticação dos clientes React](../docs/auth-react-clients.md). Recuperação e redefinição de senha também estão integradas. Telas financeiras permanecem prévias.

Referência de produto: [User Journey — InOut](https://docs.google.com/document/d/1Pl0FoTeC9pE6Vy1OjC5jrw3ErYh8_jwMSqUxyVVcmKs/edit). Decisão: [ADR-009](../docs/adr/009-react-ui-clients.md).

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
