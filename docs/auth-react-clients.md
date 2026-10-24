# Authentication in the React clients

## Scope and existing implementation

Web and Expo now implement email/password sign-in, sign-up, resend, signup OTP confirmation, PKCE email callbacks, session restoration and sign-out. Successful authentication opens `/comecar`; an account without household membership can reach onboarding without any household lookup.

This follows the existing Flutter `AuthRepository` → `SupabaseAuthRepository` flow and ADR-004. `confirmationRequired` means that signup did **not** return an authenticated session. Authentication never creates a financial account or household. The residence/account/invitation screens remain previews. Password recovery/reset are integrated as described below.

## Boundaries

- `packages/identity/index.mjs` and `index.d.ts`: provider-independent identity types, repository port, validation and application operations. Both clients consume the same local npm package.
- `packages/identity/supabase.mjs`: infrastructure adapter. Maps SDK responses/errors into application results; never returns SDK sessions, tokens or editable metadata as identity/authorization.
- `frontend/lib/auth/` and `mobile/src/auth/`: platform composition roots and presentation hooks. Web uses Supabase browser storage; native uses AsyncStorage and foreground/background refresh per the official React Native quickstart. AsyncStorage is app-local persistence, not an encrypted credential vault.
- Existing screens call the application interface, not Supabase directly. Pending email is retained only in browser tab session storage or native memory; after restarting native, it can be entered again. Passwords are not retained by application state after successful submission.
- `/comecar` checks the user with Supabase `getUser`, handles session changes and offers sign-out. This is a client-side navigation gate, **not server-side authorization**. There is no cookie/SSR auth or server-protected data endpoint in this increment. ASP.NET membership checks and database RLS remain authoritative when financial APIs are connected; never authorize from `display_name` or `user_metadata`.
- Email confirmation pages cannot assert success from a route name. They verify the authenticated user; code verification and PKCE exchange must yield a real session. Callback destinations are fixed, not read from a caller-controlled `next` URL. Web callback parameters are removed from browser history after reading.

## Book guidance applied

- **Clean Architecture**, chapter 22, Dependency Rule: use-case code has no React, Expo or provider dependency; infrastructure implements the inward-facing repository port.
- **Full Cycle**, Arquitetura Hexagonal / Hexagonal vs Clean vs Onion, printed pp. 189–190: isolate technical adapters from the application rather than coupling screens to an external service.
- **Learning Domain-Driven Design**, Generic Subdomains: reuse a proven authentication provider; do not invent a password/JWT identity system or mix identity with the household/ledger domain.
- **Designing Data-Intensive Applications**, chapter 7, Atomicity / Consistency, printed pp. 215–216: do not pretend signup plus household plus ledger initialization is one transaction. This increment performs only Auth operations and leaves financial invariants in the existing backend boundary.

## Local configuration

From the repository checkout (the sibling `packages/identity` directory must be present):

```sh
cd frontend
npm ci
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

```sh
cd mobile
npm ci
cp .env.example .env
# Fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run start
```

Both clients must use the same Supabase project as the existing Flutter app. Use a publishable key or legacy **anon** key, never a service-role/secret key. Public composition rejects privileged keys and non-local plain HTTP endpoints. Environment variables in public apps are bundled into the client; restart/rebuild after changing them. No actual keys or local environment files are committed.

`.npmrc` uses `install-links=true` to package the local identity dependency rather than linking outside the app's Metro/Turbopack root. After changing shared package source, update/reinstall that local dependency before building clients. CI always installs from the checked-out source. Both apps pin the Supabase SDK and commit their lockfiles.

## Supabase dashboard configuration

Keep email confirmation enabled. Add exact URLs to Authentication → URL Configuration → Redirect URLs:

- Web development: `http://localhost:3000/auth/callback` (or the actual development origin).
- Production web: `https://YOUR_WEB_ORIGIN/auth/callback`.
- Installed Expo development/production build: `inout://auth/callback` (existing `inout` scheme). `Linking.createURL` generates the callback for the running environment. Expo Go URLs vary; use an installed development build for reliable email deep links.

Keep the signup email template's standard `{{ .ConfirmationURL }}` link for PKCE. To enable the alternate in-app code form, also include `{{ .Token }}` in the **Confirm signup** template. Do not replace it with a magic-link/login OTP type: this implementation verifies `type: signup`. PKCE links must return to the browser/app that initiated signup because the verifier is stored there. On another device/browser, use the email code or sign in after the email has been confirmed.

No remote dashboard changes, test users or outbound emails were created by this implementation. Deployment must supply the public environment variables and dashboard redirect/template settings before a live flow works. The project SMTP/email limits still apply; the UI translates rate-limit failures and applies a one-minute resend cooldown, while Supabase enforces the actual limit.

## Verification

In this implementation session, the connected InOut project public URL/key were added only to ignored local development files. A read-only request to its public Auth settings endpoint returned HTTP 200 with email signup enabled and email confirmation required. No user was created, no email sent, and no dashboard configuration changed. These local files do not travel with a Git pull; other environments still need the values described above.

```sh
cd frontend
npm run test       # application/adapter contracts + real SDK with mocked Auth transport
npm run check
npm run build
cd ../mobile
npm run test       # shared application/adapter contracts
npm run check
npx expo export --platform android --platform ios
```

Tests cover normalized emails, unchanged passwords, rejected registrations, session-less vs immediate-session signup, OTP/session validation, server-validated user mapping, restored sessions, sign-out, rate limits, rejected privileged configuration, and absence of household calls. Transport fixtures contain only synthetic users/tokens and make no external requests.

Live email delivery, cold/warm native deep links, invalid/expired links, refresh after backgrounding, and cross-tab/device behavior still require an environment configured with the project's public Auth settings and a disposable test account. Exported native bundles do not replace device testing.

## Password recovery — 2026-10-24

`/esqueci-senha` calls the shared `requestPasswordReset` application operation. The Supabase adapter invokes `resetPasswordForEmail` with a fixed, separate callback. The UI reports the same generic success for registered and unknown addresses, displays provider/network failures, prevents concurrent submissions and applies a one-minute resend interval.

Add these exact callback destinations to the existing Supabase project's redirect allowlist:

- `http://localhost:3000/auth/recuperar` for local web (adjust only to the actual development origin).
- `https://YOUR_WEB_ORIGIN/auth/recuperar` for production web.
- `inout://auth/recuperar` for an installed Expo build.

The **Reset password** email template must preserve `{{ .ConfirmationURL }}`. The signup callback `/auth/callback` remains separate. No dashboard redirects or templates were changed in this implementation because the connected tools do not expose Auth configuration updates.

The callback exchanges a PKCE code and requires the SDK's recovery redirect type and an authenticated user. A signup code or an existing normal session does not unlock the recovery form. A short-lived, in-memory UI grant is tied to that user and expires after fifteen minutes; the user is checked again with `getUser` before `updateUser({password})`. Supabase remains the authority for credential changes: this client grant is flow gating, not an additional server authorization boundary. The email must open in the same browser/app that requested it, where the PKCE verifier is stored. Reloading/closing the recovery screen loses its in-memory grant; request a fresh link in that case.

Password length and matching are validated through the application boundary. After the provider confirms the update, the UI clears password fields and signs out the local session. A sign-out failure is reported separately from a successful password change, with a retry action; the screen does not encourage resubmitting an already successful password update. Other active devices are not explicitly revoked by this client.

Tests include real Supabase SDK recovery requests, PKCE recovery code exchange, authenticated user validation, password update and local sign-out over a mocked transport. Additional tests cover enumeration-safe responses, rate limits, missing/wrong/expired recovery grants, mismatched identity, password validation, provider failures and sign-out failure. No real recovery email or password change was performed. Live delivery and cold/warm native deep links still need testing with a disposable account after allowlist setup.
