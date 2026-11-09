import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { AuthFailure, createAuthService } from "./index.mjs";
import { createBffAuthRepository } from "./bff.mjs";

function harness(handler) {
  const calls = [];
  const fetch = async (url, init) => {
    const request = {
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(init.body) : null,
      credentials: init?.credentials,
    };
    calls.push(request);
    const result = await handler(request);
    return new Response(JSON.stringify(result.body ?? {}), {
      status: result.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    calls,
    service: createAuthService(
      createBffAuthRepository({ fetch, origin: "https://app.example" }),
    ),
  };
}

test("web sign-in posts the password only to the same-origin BFF", async () => {
  const { service, calls } = harness(() => ({ body: { code: "signed_in" } }));
  await service.signIn({ email: "User@Example.com", password: "password8" });
  assert.equal(calls[0].url, "https://app.example/api/auth/login");
  assert.equal(calls[0].credentials, "same-origin");
  assert.deepEqual(calls[0].body, {
    email: "user@example.com",
    password: "password8",
  });
});

test("registration stays confirmation-required and recovery is enumeration-safe", async () => {
  const registered = harness(() => ({
    body: { confirmationRequired: true },
  }));
  assert.equal(
    await registered.service.signUp({
      name: "Ada",
      email: "a@b.com",
      password: "password8",
      confirmation: "password8",
    }),
    "confirmationRequired",
  );
  const reset = harness((request) =>
    request.url.endsWith("/forgot")
      ? { body: { code: "confirmation_required" } }
      : { status: 400, body: { code: "recovery_required" } },
  );
  await reset.service.requestPasswordReset("a@b.com");
  assert.equal(await reset.service.canResetPassword(), false);
  await assert.rejects(
    reset.service.resetPassword({ password: "password9", confirmation: "password9" }),
    (error) => error instanceof AuthFailure && error.code === "recovery_required",
  );
});

test("recovery exchange requires email and code and reset does not return a token", async () => {
  const { service, calls } = harness((request) => {
    if (request.url.endsWith("/session")) {
      return { body: { canReset: true, recoveryExpiresAt: Date.now() + 1000, user: null } };
    }
    return { body: { code: "signed_in" } };
  });
  await assert.rejects(
    service.exchangeRecoveryCode("only-code"),
    (error) => error.code === "recovery_required",
  );
  await service.exchangeRecoveryCode("a@b.com 12345678");
  assert.equal(await service.canResetPassword(), true);
  assert.equal(
    await service.resetPassword({ password: "password9", confirmation: "password9" }),
    "signedOut",
  );
  assert.equal(calls.at(-1).url, "https://app.example/api/auth/reset");
  assert.equal(JSON.stringify(calls).includes("access_token"), false);
  assert.equal(createHash("sha256").update("ok").digest("hex").length, 64);
});
