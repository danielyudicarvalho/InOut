# Autenticação dos clientes

O web e o mobile compartilham `packages/identity`. Nenhum deles fala com o provedor antigo.

- Web: `createBffAuthRepository` chama apenas rotas same-origin em `/api/auth/*`. O cookie `inout_session` é HttpOnly e cifrado com AES-GCM. O JavaScript recebe só um valor de CSRF, que o proxy em `/api/v1/*` troca pelo access token.
- Mobile: `createOpenIdAuthRepository` abre o navegador do sistema em `/connect/authorize` com PKCE S256. O cliente público é `inout-mobile`. Não existe `client_secret`. Os tokens de referência ficam no SecureStore.
- Cadastro, confirmação, esqueci a senha e nova senha no mobile abrem páginas hospedadas em `/account/*`. A senha não é coletada pelo aplicativo.

Variáveis públicas:

```bash
# mobile/.env
EXPO_PUBLIC_AUTH_ISSUER=https://api.example.com
EXPO_PUBLIC_API_BASE_URL=https://api.example.com
```

O web não publica URL de auth nem chave. No servidor do Next:

```bash
API_BASE_URL=https://api.example.com
AUTH_WEB_CLIENT_SECRET=...
BFF_SESSION_KEY=... # 32 bytes em base64; obrigatório em produção
```

Redirects nativos permitidos, sem curingas: `inout://auth/callback` e `inout://auth/recuperar`.
