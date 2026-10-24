import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  AuthFailure,
  createAuthService,
  requirePublicConfig,
} from "@inout/identity";
import { createSupabaseAuthRepository } from "@inout/identity/supabase";
let client: SupabaseClient | undefined;
export function getAuthClient() {
  if (typeof window === "undefined") throw new AuthFailure("configuration");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  requirePublicConfig(url, key);
  return (client ??= createClient(url!, key!, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  }));
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
