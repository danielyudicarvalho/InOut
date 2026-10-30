import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  AuthFailure,
  createAuthService,
  requirePublicConfig,
} from "@inout/identity";
import { createSupabaseAuthRepository } from "@inout/identity/supabase";
let client: SupabaseClient | undefined;

export function syncSessionCookie(
  session: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null,
) {
  if (typeof window === "undefined") return;
  if (session?.access_token) {
    fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in,
      }),
    }).catch(() => {});
  } else {
    fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
  }
}

export function getAuthClient() {
  if (typeof window === "undefined") throw new AuthFailure("configuration");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  requirePublicConfig(url, key);
  if (!client) {
    client = createClient(url!, key!, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    client.auth.onAuthStateChange((_event, session) => {
      syncSessionCookie(session);
    });

    client.auth.getSession().then(({ data }) => {
      if (data?.session) {
        syncSessionCookie(data.session);
      }
    });
  }
  return client;
}
export function getAuth() {
  return createAuthService(
    createSupabaseAuthRepository(
      getAuthClient(),
      `${window.location.origin}/auth/callback`,
      `${window.location.origin}/auth/recuperar`,
    ),
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
