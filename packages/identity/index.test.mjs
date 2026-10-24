import test from "node:test";
import assert from "node:assert/strict";
import { createAuthService, AuthFailure, authMessage } from "./index.mjs";
function fixture(result = "confirmationRequired") {
  const calls = [];
  const repo = {
    signIn: async (x) => {
      calls.push(x);
    },
    signUp: async (x) => {
      calls.push(x);
      return result;
    },
    currentUser: async () => null,
    resend: async (x) => {
      calls.push(x);
    },
    confirm: async (...x) => {
      calls.push(x);
    },
    exchangeCode: async (x) => {
      calls.push(x);
    },
    signOut: async () => {},
  };
  return { service: createAuthService(repo), calls };
}
test("normalizes identity email without changing password", async () => {
  const { service, calls } = fixture();
  await service.signIn({ email: " USER@Example.COM ", password: " secret " });
  assert.deepEqual(calls, [
    { email: "user@example.com", password: " secret " },
  ]);
});
test("unconfirmed signup does not imply a signed-in user or create household", async () => {
  const { service, calls } = fixture();
  assert.equal(
    await service.signUp({
      name: " Yudi ",
      email: "USER@EXAMPLE.COM",
      password: "password8",
      confirmation: "password8",
    }),
    "confirmationRequired",
  );
  assert.equal(await service.currentUser(), null);
  assert.deepEqual(calls, [
    { name: "Yudi", email: "user@example.com", password: "password8" },
  ]);
});
test("immediate session signup result is retained", async () => {
  const { service } = fixture("signedIn");
  assert.equal(
    await service.signUp({
      name: "Yudi",
      email: "a@b.com",
      password: "password8",
      confirmation: "password8",
    }),
    "signedIn",
  );
});
test("invalid registration never reaches provider", async () => {
  for (const patch of [
    { name: " " },
    { email: "invalid" },
    { password: "short" },
    { confirmation: "other" },
  ]) {
    const { service, calls } = fixture();
    await assert.rejects(
      service.signUp({
        name: "Yudi",
        email: "a@b.com",
        password: "password8",
        confirmation: "password8",
        ...patch,
      }),
      AuthFailure,
    );
    assert.equal(calls.length, 0);
  }
});
test("resend and confirmation validate and normalize identity", async () => {
  const { service, calls } = fixture();
  await service.resend(" A@B.COM ");
  await service.confirm(" A@B.COM ", " 123456 ");
  assert.deepEqual(calls, ["a@b.com", ["a@b.com", "123456"]]);
  await assert.rejects(service.confirm("a@b.com", "bad"), AuthFailure);
});
test("provider messages never leak technical details or credentials", () => {
  assert.equal(
    authMessage(new AuthFailure("invalid_credentials")),
    "E-mail ou senha incorretos.",
  );
  assert.ok(!authMessage(new Error("secret access token")).includes("secret"));
  assert.ok(
    !authMessage(new AuthFailure("raw backend secret")).includes("secret"),
  );
});

test("public composition refuses privileged keys and non-local plaintext endpoints", async () => {
  const { requirePublicConfig } = await import("./index.mjs");
  assert.throws(
    () => requirePublicConfig("https://example.com", "sb_secret_private"),
    AuthFailure,
  );
  assert.throws(
    () => requirePublicConfig("http://example.com", "sb_publishable_public"),
    AuthFailure,
  );
  assert.deepEqual(
    requirePublicConfig("http://localhost:54321", "sb_publishable_public"),
    { url: "http://localhost:54321", key: "sb_publishable_public" },
  );
  const jwt =
    "a." +
    Buffer.from(JSON.stringify({ role: "service_role" })).toString(
      "base64url",
    ) +
    ".b";
  assert.throws(
    () => requirePublicConfig("https://example.com", jwt),
    AuthFailure,
  );
});
