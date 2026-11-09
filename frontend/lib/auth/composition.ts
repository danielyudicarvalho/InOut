import { AuthFailure, createAuthService, requireIssuer } from "@inout/identity";
import { createBffAuthRepository } from "@inout/identity/bff";

type SessionPayload = {
  user: { id: string; email: string; emailConfirmed: boolean } | null;
  csrf: string | null;
};

export function browserApiBase() {
  if (typeof window === "undefined") throw new AuthFailure("configuration");
  return window.location.origin;
}

async function session(): Promise<SessionPayload | null> {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new AuthFailure("session_missing");
  return (await response.json()) as SessionPayload;
}

export function getAuthClient() {
  if (typeof window === "undefined") throw new AuthFailure("configuration");
  return {
    auth: {
      async getSession() {
        const current = await session();
        if (!current?.csrf || !current.user)
          return { data: { session: null }, error: null };
        return {
          data: {
            session: {
              access_token: current.csrf,
              user: { id: current.user.id },
            },
          },
          error: null,
        };
      },
      async getUser() {
        const current = await session();
        return {
          data: { user: current?.user ? { id: current.user.id } : null },
          error: null,
        };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
  };
}

export function getAuth() {
  if (typeof window === "undefined") throw new AuthFailure("configuration");
  requireIssuer(window.location.origin);
  const channel =
    typeof BroadcastChannel === "function"
      ? new BroadcastChannel("inout-auth")
      : undefined;
  return createAuthService(
    createBffAuthRepository({
      fetch: (input, init) => fetch(input, init),
      origin: window.location.origin,
      channel,
    }),
  );
}

export function rememberEmail(email: string) {
  try {
    sessionStorage.setItem("ninho.pending-email", email.trim().toLowerCase());
  } catch {
    /* Confirmation also supports manual email entry. */
  }
}

export function pendingEmail() {
  try {
    return sessionStorage.getItem("ninho.pending-email") ?? "";
  } catch {
    return "";
  }
}
