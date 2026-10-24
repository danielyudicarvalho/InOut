import { AuthFailure } from "./index.mjs";
const recoveryGrants = new WeakMap();
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
export function createSupabaseAuthRepository(
  client,
  redirectTo,
  recoveryRedirectTo,
) {
  async function canResetPassword() {
    const grant = recoveryGrants.get(client);
    if (!grant || grant.expiresAt <= Date.now()) {
      recoveryGrants.delete(client);
      return false;
    }
    const { data, error } = await client.auth.getUser();
    checked(error);
    return data.user?.id === grant.userId;
  }
  return {
    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange(() => listener());
      return () => data.subscription.unsubscribe();
    },
    async signIn(credentials) {
      recoveryGrants.delete(client);
      const { data, error } = await client.auth.signInWithPassword(credentials);
      checked(error);
      if (!data.session) throw new AuthFailure("session_missing");
    },
    async signUp({ name, ...credentials }) {
      recoveryGrants.delete(client);
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
      recoveryGrants.delete(client);
      const { data, error } = await client.auth.verifyOtp({
        type: "signup",
        email,
        token,
      });
      checked(error);
      if (!data.session) throw new AuthFailure("session_missing");
    },
    async exchangeCode(code) {
      recoveryGrants.delete(client);
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      checked(error);
      if (!data.session) throw new AuthFailure("session_missing");
    },
    async requestPasswordReset(email) {
      if (!recoveryRedirectTo) throw new AuthFailure("configuration");
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirectTo,
      });
      if (error?.code !== "user_not_found") checked(error);
    },
    async exchangeRecoveryCode(code) {
      recoveryGrants.delete(client);
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      checked(error);
      if (!data.session || data.redirectType !== "recovery" || !data.user?.id)
        throw new AuthFailure("recovery_required");
      recoveryGrants.set(client, {
        userId: data.user.id,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
    },
    canResetPassword,
    async resetPassword(password) {
      if (!(await canResetPassword()))
        throw new AuthFailure("recovery_required");
      const { error } = await client.auth.updateUser({ password });
      checked(error);
      recoveryGrants.delete(client);
      try {
        const { error: signOutError } = await client.auth.signOut({
          scope: "local",
        });
        return signOutError ? "signOutRequired" : "signedOut";
      } catch {
        return "signOutRequired";
      }
    },
    async signOut() {
      recoveryGrants.delete(client);
      const { error } = await client.auth.signOut();
      checked(error);
    },
  };
}
