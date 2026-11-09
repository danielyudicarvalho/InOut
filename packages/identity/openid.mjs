import { AuthFailure, hostedAccountPath } from "./index.mjs";

const sessionKey = "inout.openid.session";
const pkceKey = "inout.openid.pkce";

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** Public client. No client secret. Tokens stay in the injected store (SecureStore in the app). */
export function createOpenIdAuthRepository({
  issuer,
  clientId,
  redirectUri,
  storage,
  openBrowser,
  fetch,
  sha256,
  randomBytes,
  now = () => Date.now(),
}) {
  async function read(key) {
    const raw = await storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
  async function tokens() {
    const current = await read(sessionKey);
    if (!current) return null;
    if (current.expiresAt - 30_000 > now()) return current;
    const response = await fetch(new URL("/connect/token", issuer), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: current.refreshToken,
      }),
    });
    if (!response.ok) {
      await storage.deleteItem(sessionKey);
      return null;
    }
    const json = await response.json();
    const next = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? current.refreshToken,
      expiresAt: now() + Number(json.expires_in) * 1000,
    };
    await storage.setItem(sessionKey, JSON.stringify(next));
    return next;
  }
  async function exchange(code, verifier, redirect) {
    const response = await fetch(new URL("/connect/token", issuer), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirect,
        code,
        code_verifier: verifier,
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.access_token || !json.refresh_token)
      throw new AuthFailure("invalid_token");
    if (JSON.stringify(json).includes("client_secret"))
      throw new AuthFailure("configuration");
    await storage.setItem(
      sessionKey,
      JSON.stringify({
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt: now() + Number(json.expires_in) * 1000,
      }),
    );
    await storage.deleteItem(pkceKey);
  }
  return {
    subscribe(listener) {
      return () => {
        void listener;
      };
    },
    async signIn() {
      throw new AuthFailure("browser_sign_in_required");
    },
    async beginBrowserSignIn() {
      const verifier = base64url(await randomBytes(32));
      const challenge = base64url(await sha256(verifier));
      const state = base64url(await randomBytes(16));
      await storage.setItem(pkceKey, JSON.stringify({ verifier, state, redirectUri }));
      const url = new URL("/connect/authorize", issuer);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile offline_access");
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("state", state);
      const result = await openBrowser(url.toString(), redirectUri);
      const returned = result?.url ? new URL(result.url) : null;
      const code = returned?.searchParams.get("code");
      if (!returned || returned.searchParams.get("state") !== state || !code)
        throw new AuthFailure("invalid_token");
      await exchange(code, verifier, redirectUri);
    },
    async openHostedAccount(path) {
      await openBrowser(new URL(hostedAccountPath(path), issuer).toString());
    },
    async signUp() {
      throw new AuthFailure("browser_sign_in_required");
    },
    async currentUser() {
      const current = await tokens();
      if (!current) return null;
      const response = await fetch(new URL("/connect/userinfo", issuer), {
        headers: { authorization: `Bearer ${current.accessToken}`, accept: "application/json" },
      });
      if (response.status === 401) return null;
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.sub) throw new AuthFailure("session_missing");
      return {
        id: body.sub,
        email: body.email ?? "",
        emailConfirmed: body.email_verified === "true",
      };
    },
    async resend() {
      throw new AuthFailure("browser_sign_in_required");
    },
    async confirm() {
      throw new AuthFailure("browser_sign_in_required");
    },
    async exchangeCode(code) {
      const pending = await read(pkceKey);
      if (!pending?.verifier) throw new AuthFailure("bad_code_verifier");
      await exchange(code, pending.verifier, pending.redirectUri);
    },
    async requestPasswordReset() {
      await openBrowser(new URL("/account/forgot", issuer).toString());
    },
    async exchangeRecoveryCode() {
      throw new AuthFailure("browser_sign_in_required");
    },
    async canResetPassword() {
      return false;
    },
    async resetPassword() {
      throw new AuthFailure("browser_sign_in_required");
    },
    async signOut() {
      const current = await read(sessionKey);
      if (current?.refreshToken) {
        await fetch(new URL("/connect/revoke", issuer), {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            token: current.refreshToken,
            token_type_hint: "refresh_token",
          }),
        }).catch(() => undefined);
      }
      await storage.deleteItem(sessionKey);
      await storage.deleteItem(pkceKey);
    },
    async accessToken() {
      return (await tokens())?.accessToken ?? null;
    },
  };
}

export function createOpenIdSession(repository) {
  return {
    auth: {
      async getSession() {
        const accessToken = await repository.accessToken();
        if (!accessToken) return { data: { session: null }, error: null };
        const user = await repository.currentUser();
        return {
          data: {
            session: user ? { access_token: accessToken, user: { id: user.id } } : null,
          },
          error: null,
        };
      },
      async getUser() {
        const user = await repository.currentUser();
        return { data: { user: user ? { id: user.id } : null }, error: null };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
  };
}
