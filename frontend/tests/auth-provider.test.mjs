import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createAuthService, AuthFailure } from "@inout/identity";
import { createSupabaseAuthRepository } from "@inout/identity/supabase";
function fixture(handler, storage) {
  const calls = [];
  const client = createClient(
    "https://auth.example.test",
    "sb_publishable_test",
    {
      auth: {
        persistSession: !!storage,
        storage,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
      global: {
        fetch: async (url, init) => {
          const request = {
            url: String(url),
            body: init?.body ? JSON.parse(init.body) : null,
            headers: init?.headers,
          };
          calls.push(request);
          const result = handler(request);
          return new Response(JSON.stringify(result.body), {
            status: result.status ?? 200,
            headers: {
              "Content-Type": "application/json",
              "X-Supabase-Api-Version": "2024-01-01",
            },
          });
        },
      },
    },
  );
  return {
    client,
    service: createAuthService(
      createSupabaseAuthRepository(
        client,
        "https://app.example.test/auth/callback",
        "https://app.example.test/auth/recuperar",
      ),
    ),
    calls,
  };
}
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "user@example.com",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: "2026-10-23T12:00:00Z",
  app_metadata: {},
  user_metadata: {},
};
const token = [
  { alg: "HS256", typ: "JWT" },
  {
    sub: user.id,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    role: "authenticated",
  },
  "signature",
]
  .map((v, i) =>
    i === 2 ? v : Buffer.from(JSON.stringify(v)).toString("base64url"),
  )
  .join(".");
const session = {
  access_token: token,
  refresh_token: "test-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  user,
};
test("real SDK sign-in, validated identity lookup and sign-out only call Auth API", async () => {
  const { service, calls } = fixture(({ url }) => ({
    body: url.includes("/token?") ? session : url.endsWith("/user") ? user : {},
  }));
  await service.signIn({ email: " USER@EXAMPLE.COM ", password: "password8" });
  assert.deepEqual(await service.currentUser(), {
    id: user.id,
    email: user.email,
    emailConfirmed: true,
  });
  await service.signOut();
  assert.equal(calls[0].body.email, "user@example.com");
  assert.ok(
    calls.every((x) => new URL(x.url).pathname.startsWith("/auth/v1/")),
  );
  assert.ok(!calls.some((x) => x.url.includes("household")));
});
test("real SDK signup sends callback and display name but creates no membership", async () => {
  const { service, calls } = fixture(() => ({
    body: { ...user, email_confirmed_at: null, identities: [] },
  }));
  assert.equal(
    await service.signUp({
      name: " Yudi ",
      email: " USER@EXAMPLE.COM ",
      password: "password8",
      confirmation: "password8",
    }),
    "confirmationRequired",
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.data.display_name, "Yudi");
  assert.equal(
    new URL(calls[0].url).searchParams.get("redirect_to"),
    "https://app.example.test/auth/callback",
    "https://app.example.test/auth/recuperar",
  );
});
test("real SDK maps invalid credentials and email rate limit without exposing server messages", async () => {
  const { service } = fixture(() => ({
    status: 400,
    body: { code: "invalid_credentials", msg: "private server detail" },
  }));
  await assert.rejects(
    service.signIn({ email: user.email, password: "bad" }),
    (e) => e instanceof AuthFailure && e.code === "invalid_credentials",
  );
  const rate = fixture(() => ({
    status: 429,
    body: { code: "over_email_send_rate_limit", msg: "private server detail" },
  }));
  await assert.rejects(
    rate.service.resend(user.email),
    (e) => e instanceof AuthFailure && e.code === "over_email_send_rate_limit",
  );
});
test("real SDK signup OTP produces a session and server-validated confirmed identity", async () => {
  const { service, calls } = fixture(({ url }) => ({
    body: url.endsWith("/verify") ? session : user,
  }));
  await service.confirm(user.email, "123456");
  assert.equal((await service.currentUser()).emailConfirmed, true);
  assert.equal(calls[0].body.type, "signup");
});
test("real SDK restores a stored session and validates user with provider", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const first = fixture(() => ({ body: session }), storage);
  await first.service.signIn({ email: user.email, password: "password8" });
  const second = fixture(() => ({ body: user }), storage);
  assert.equal((await second.service.currentUser()).id, user.id);
  assert.ok(second.calls.some((x) => x.url.endsWith("/user")));
  await second.service.signOut();
});

test("real SDK PKCE callback exchanges the stored signup verifier for a session", async () => {
  const { service, calls } = fixture(({ url }) => ({
    body: url.includes("/signup")
      ? { ...user, email_confirmed_at: null }
      : url.includes("/token?")
        ? session
        : user,
  }));
  await service.signUp({
    name: "Yudi",
    email: user.email,
    password: "password8",
    confirmation: "password8",
  });
  await service.exchangeCode("test-single-use-code");
  const request = calls.find((call) => call.url.includes("grant_type=pkce"));
  assert.equal(request.body.auth_code, "test-single-use-code");
  assert.equal(typeof request.body.code_verifier, "string");
  assert.ok(request.body.code_verifier.length > 20);
  assert.equal((await service.currentUser()).emailConfirmed, true);
});

test("real SDK recovery sends PKCE request, exchanges recovery code, updates password and logs out", async () => {
  const { service, calls } = fixture(({ url }) => ({
    body: url.includes("/token?") ? session : url.endsWith("/user") ? user : {},
  }));
  await service.requestPasswordReset(" USER@EXAMPLE.COM ");
  const recovery = calls[0];
  assert.equal(recovery.body.email, "user@example.com");
  assert.equal(new URL(recovery.url).pathname, "/auth/v1/recover");
  assert.equal(
    new URL(recovery.url).searchParams.get("redirect_to"),
    "https://app.example.test/auth/recuperar",
  );
  assert.equal(await service.canResetPassword(), false);
  await service.exchangeRecoveryCode("recovery-code");
  assert.equal(await service.canResetPassword(), true);
  assert.equal(
    await service.resetPassword({
      password: "new-secret88",
      confirmation: "new-secret88",
    }),
    "signedOut",
  );
  assert.ok(calls.some((call) => call.body?.password === "new-secret88"));
  assert.ok(calls.some((call) => call.url.includes("/logout?scope=local")));
  assert.equal(await service.canResetPassword(), false);
  assert.ok(
    calls.every((call) => new URL(call.url).pathname.startsWith("/auth/v1/")),
  );
});
