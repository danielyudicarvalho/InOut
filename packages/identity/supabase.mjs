import { AuthFailure } from "./index.mjs";
function checked(error) {
  if (error) throw new AuthFailure(error.code || "provider_error");
}
function user(value) {
  return value?.email
    ? {
        id: value.id,
        email: value.email,
        emailConfirmed: !!value.email_confirmed_at,
      }
    : null;
}
/** Infrastructure adapter; SDK shapes never cross the application port. */
export function createSupabaseAuthRepository(client, redirectTo) {
  return {
    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange(() => listener());
      return () => data.subscription.unsubscribe();
    },
    async signIn(credentials) {
      const { data, error } = await client.auth.signInWithPassword(credentials);
      checked(error);
      if (!data.session) throw new AuthFailure("session_missing");
    },
    async signUp({ name, ...credentials }) {
      const { data, error } = await client.auth.signUp({
        ...credentials,
        options: { emailRedirectTo: redirectTo, data: { display_name: name } },
      });
      checked(error);
      return data.session ? "signedIn" : "confirmationRequired";
    },
    async currentUser() {
      const { data, error } = await client.auth.getUser();
      if (
        error?.code === "session_not_found" ||
        error?.name === "AuthSessionMissingError"
      )
        return null;
      checked(error);
      return user(data.user);
    },
    async resend(email) {
      const { error } = await client.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectTo },
      });
      checked(error);
    },
    async confirm(email, token) {
      const { data, error } = await client.auth.verifyOtp({
        type: "signup",
        email,
        token,
      });
      checked(error);
      if (!data.session) throw new AuthFailure("session_missing");
    },
    async exchangeCode(code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      checked(error);
      if (!data.session) throw new AuthFailure("session_missing");
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      checked(error);
    },
  };
}
