import { AuthFailure } from "./index.mjs";

/** Browser calls only the same-origin BFF. Access and refresh tokens stay on the server. */
export function createBffAuthRepository({
  fetch,
  origin,
  channel,
  now = () => Date.now(),
}) {
  const listeners = new Set();
  function notify() {
    for (const listener of listeners) listener();
    channel?.postMessage?.("changed");
  }
  async function send(path, body, method = "POST") {
    const response = await fetch(new URL(path, origin), {
      method,
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new AuthFailure(payload.code || "provider_error");
    return payload;
  }
  return {
    subscribe(listener) {
      listeners.add(listener);
      const onMessage = () => listener();
      channel?.addEventListener?.("message", onMessage);
      return () => {
        listeners.delete(listener);
        channel?.removeEventListener?.("message", onMessage);
      };
    },
    async signIn(credentials) {
      await send("/api/auth/login", {
        email: credentials.email,
        password: credentials.password,
      });
      notify();
    },
    async signUp({ name, email, password }) {
      const result = await send("/api/auth/register", { name, email, password });
      notify();
      return result.confirmationRequired === false ? "signedIn" : "confirmationRequired";
    },
    async currentUser() {
      const response = await fetch(new URL("/api/auth/session", origin), {
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) return null;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new AuthFailure(payload.code || "provider_error");
      return payload.user ?? null;
    },
    resend: (email) => send("/api/auth/resend", { email }),
    async confirm(email, code) {
      await send("/api/auth/confirm", { email, code });
      notify();
    },
    async exchangeCode() {
      throw new AuthFailure("configuration");
    },
    requestPasswordReset: (email) => send("/api/auth/forgot", { email }),
    async exchangeRecoveryCode(value) {
      const [email, code] = String(value).split(" ");
      if (!email || !code) throw new AuthFailure("recovery_required");
      await send("/api/auth/recovery", { email, code });
      notify();
    },
    async canResetPassword() {
      const response = await fetch(new URL("/api/auth/session", origin), {
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (!response.ok) return false;
      const payload = await response.json().catch(() => ({}));
      return payload.canReset === true && (payload.recoveryExpiresAt ?? 0) > now();
    },
    async resetPassword(password) {
      await send("/api/auth/reset", { password });
      notify();
      return "signedOut";
    },
    async signOut() {
      await send("/api/auth/logout", {});
      notify();
    },
  };
}
