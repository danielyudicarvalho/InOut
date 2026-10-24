import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseAuthRepository } from "./supabase.mjs";
import { AuthFailure } from "./index.mjs";
const redirect = "inout://auth/callback";
test("SDK adapter separates session-less signup from signed-in response", async () => {
  let input;
  const auth = {
    signUp: async (x) => {
      input = x;
      return { data: { session: null }, error: null };
    },
  };
  const repo = createSupabaseAuthRepository({ auth }, redirect);
  assert.equal(
    await repo.signUp({
      name: "Yudi",
      email: "a@b.com",
      password: "password8",
    }),
    "confirmationRequired",
  );
  assert.equal(input.options.emailRedirectTo, redirect);
  assert.equal(input.options.data.display_name, "Yudi");
});
test("SDK adapter maps only identity, never provider tokens or editable role metadata", async () => {
  const repo = createSupabaseAuthRepository(
    {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "id",
              email: "a@b.com",
              email_confirmed_at: "now",
              user_metadata: { role: "admin" },
            },
          },
          error: null,
        }),
      },
    },
    redirect,
  );
  assert.deepEqual(await repo.currentUser(), {
    id: "id",
    email: "a@b.com",
    emailConfirmed: true,
  });
});
test("missing session is a normal unauthenticated state", async () => {
  const repo = createSupabaseAuthRepository(
    {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { name: "AuthSessionMissingError" },
        }),
      },
    },
    redirect,
  );
  assert.equal(await repo.currentUser(), null);
});
test("provider errors are translated at boundary", async () => {
  const repo = createSupabaseAuthRepository(
    {
      auth: {
        signInWithPassword: async () => ({
          data: {},
          error: { code: "invalid_credentials", message: "private detail" },
        }),
      },
    },
    redirect,
  );
  await assert.rejects(
    repo.signIn({ email: "a@b.com", password: "bad" }),
    (e) => e instanceof AuthFailure && e.code === "invalid_credentials",
  );
});
test("confirmation uses signup OTP and refuses false success without session", async () => {
  let input;
  const repo = createSupabaseAuthRepository(
    {
      auth: {
        verifyOtp: async (x) => {
          input = x;
          return { data: { session: null }, error: null };
        },
      },
    },
    redirect,
  );
  await assert.rejects(repo.confirm("a@b.com", "123456"), AuthFailure);
  assert.deepEqual(input, {
    email: "a@b.com",
    token: "123456",
    type: "signup",
  });
});
test("resend keeps fixed callback and signout propagates failure", async () => {
  let input;
  const repo = createSupabaseAuthRepository(
    {
      auth: {
        resend: async (x) => {
          input = x;
          return { error: null };
        },
        signOut: async () => ({ error: { code: "offline" } }),
      },
    },
    redirect,
  );
  await repo.resend("a@b.com");
  assert.equal(input.options.emailRedirectTo, redirect);
  await assert.rejects(repo.signOut(), AuthFailure);
});

test("subscription exposes only a change signal and unsubscribes", () => {
  let callback;
  let cleaned = false;
  let received;
  const repo = createSupabaseAuthRepository(
    {
      auth: {
        onAuthStateChange: (listener) => {
          callback = listener;
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  cleaned = true;
                },
              },
            },
          };
        },
      },
    },
    redirect,
  );
  const unsubscribe = repo.subscribe((...args) => {
    received = args;
  });
  callback("SIGNED_IN", { access_token: "private" });
  assert.deepEqual(received, []);
  unsubscribe();
  assert.equal(cleaned, true);
});
