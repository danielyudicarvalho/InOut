import test from "node:test";
import assert from "node:assert/strict";
import { AuthFailure, createAuthService } from "./index.mjs";
import { createSupabaseAuthRepository } from "./supabase.mjs";
function fixture(overrides = {}) {
  const calls = [];
  const client = {
    auth: {
      resetPasswordForEmail: async (...args) => {
        calls.push(["request", ...args]);
        return { error: null };
      },
      exchangeCodeForSession: async () => ({
        data: { session: {}, user: { id: "user" }, redirectType: "recovery" },
        error: null,
      }),
      getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
      updateUser: async (input) => {
        calls.push(["update", input]);
        return { error: null };
      },
      signOut: async (input) => {
        calls.push(["signout", input]);
        return { error: null };
      },
      ...overrides,
    },
  };
  const repository = () =>
    createSupabaseAuthRepository(
      client,
      "https://app.test/auth/callback",
      "https://app.test/auth/recuperar",
    );
  return {
    calls,
    client,
    repository,
    service: createAuthService(repository()),
  };
}
test("recovery normalizes email and sends fixed recovery callback", async () => {
  const { service, calls } = fixture();
  await service.requestPasswordReset(" USER@EXAMPLE.COM ");
  assert.deepEqual(calls, [
    [
      "request",
      "user@example.com",
      { redirectTo: "https://app.test/auth/recuperar" },
    ],
  ]);
  await assert.rejects(service.requestPasswordReset("bad"), AuthFailure);
  assert.equal(calls.length, 1);
});
test("unknown account is indistinguishable from a successful request; rate errors still surface", async () => {
  await fixture({
    resetPasswordForEmail: async () => ({ error: { code: "user_not_found" } }),
  }).service.requestPasswordReset("a@b.com");
  await assert.rejects(
    fixture({
      resetPasswordForEmail: async () => ({
        error: { code: "over_email_send_rate_limit" },
      }),
    }).service.requestPasswordReset("a@b.com"),
    (e) => e.code === "over_email_send_rate_limit",
  );
});
test("ordinary sign-in session or direct reset URL cannot authorize recovery UI", async () => {
  const { service, calls } = fixture();
  assert.equal(await service.canResetPassword(), false);
  await assert.rejects(
    service.resetPassword({ password: "newpass88", confirmation: "newpass88" }),
    (e) => e.code === "recovery_required",
  );
  assert.deepEqual(calls, []);
});
test("signup code and expired recovery code never grant password reset", async () => {
  for (const response of [
    {
      data: { session: {}, user: { id: "user" }, redirectType: null },
      error: null,
    },
    { data: {}, error: { code: "flow_state_expired" } },
  ]) {
    const { service, calls } = fixture({
      exchangeCodeForSession: async () => response,
    });
    await assert.rejects(service.exchangeRecoveryCode("code"), AuthFailure);
    assert.equal(await service.canResetPassword(), false);
    assert.deepEqual(calls, []);
  }
});
test("validated recovery grant survives adapter recomposition and is consumed after update", async () => {
  const { service, repository, calls } = fixture();
  await service.exchangeRecoveryCode("code");
  assert.equal(await repository().canResetPassword(), true);
  assert.equal(
    await service.resetPassword({
      password: "newpass88",
      confirmation: "newpass88",
    }),
    "signedOut",
  );
  assert.deepEqual(calls, [
    ["update", { password: "newpass88" }],
    ["signout", { scope: "local" }],
  ]);
  assert.equal(await service.canResetPassword(), false);
  await assert.rejects(
    service.resetPassword({ password: "newpass88", confirmation: "newpass88" }),
    AuthFailure,
  );
});
test("weak and mismatched passwords never reach provider", async () => {
  const { service, calls } = fixture();
  await service.exchangeRecoveryCode("code");
  for (const input of [
    { password: "short", confirmation: "short" },
    { password: "newpass88", confirmation: "otherpass" },
  ])
    await assert.rejects(service.resetPassword(input), AuthFailure);
  assert.deepEqual(calls, []);
});
test("recovery grant cannot update a different authenticated user", async () => {
  const { service, calls } = fixture({
    getUser: async () => ({ data: { user: { id: "other" } }, error: null }),
  });
  await service.exchangeRecoveryCode("code");
  await assert.rejects(
    service.resetPassword({ password: "newpass88", confirmation: "newpass88" }),
    AuthFailure,
  );
  assert.deepEqual(calls, []);
});
test("failed provider update preserves retry; failed signout reports password already changed", async () => {
  const failed = fixture({
    updateUser: async () => ({ error: { code: "same_password" } }),
  });
  await failed.service.exchangeRecoveryCode("code");
  await assert.rejects(
    failed.service.resetPassword({
      password: "newpass88",
      confirmation: "newpass88",
    }),
    (e) => e.code === "same_password",
  );
  assert.equal(await failed.service.canResetPassword(), true);
  const logout = fixture({
    signOut: async () => ({ error: { code: "offline" } }),
  });
  await logout.service.exchangeRecoveryCode("code");
  assert.equal(
    await logout.service.resetPassword({
      password: "newpass88",
      confirmation: "newpass88",
    }),
    "signOutRequired",
  );
  assert.equal(await logout.service.canResetPassword(), false);
});

test("recovery UI grant expires after fifteen minutes", async (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const { service, calls } = fixture();
  await service.exchangeRecoveryCode("code");
  now += 15 * 60 * 1000;
  assert.equal(await service.canResetPassword(), false);
  await assert.rejects(
    service.resetPassword({ password: "newpass88", confirmation: "newpass88" }),
    AuthFailure,
  );
  assert.deepEqual(calls, []);
});
