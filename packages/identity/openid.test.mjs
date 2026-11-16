import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { AuthFailure, createAuthService } from "./index.mjs";
import {
  completeAuthorizationCallback,
  createOpenIdAuthRepository,
  createOpenIdSession,
} from "./openid.mjs";

function memory() {
  const values = new Map();
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    deleteItem: async (key) => {
      values.delete(key);
    },
  };
}

function repository(handler, storage = memory()) {
  const calls = [];
  const opened = [];
  const repo = createOpenIdAuthRepository({
    issuer: "https://auth.example",
    clientId: "inout-mobile",
    redirectUri: "inout://auth/callback",
    storage,
    openBrowser: async (url) => {
      opened.push(url);
      const challenge = new URL(url).searchParams.get("code_challenge");
      return { url: `inout://auth/callback?code=code-1&state=${new URL(url).searchParams.get("state")}`, challenge };
    },
    fetch: async (url, init) => {
      const body = init?.body ? Object.fromEntries(new URLSearchParams(init.body)) : null;
      calls.push({ url: String(url), body, authorization: init?.headers?.authorization });
      const result = await handler({ url: String(url), body });
      return new Response(JSON.stringify(result.body ?? {}), { status: result.status ?? 200 });
    },
    sha256: async (value) => createHash("sha256").update(value).digest(),
    randomBytes: async (length) => randomBytes(length),
  });
  return { repo, calls, opened, storage, service: createAuthService(repo) };
}

test("mobile sign-in uses S256 PKCE in the system browser and sends no client secret", async () => {
  const { service, calls, opened } = repository(() => ({
    body: { access_token: "access", refresh_token: "refresh", expires_in: 600 },
  }));
  await assert.rejects(service.signIn({ email: "a@b.com", password: "password8" }), (error) =>
    error instanceof AuthFailure && error.code === "browser_sign_in_required",
  );
  await service.beginBrowserSignIn();
  const authorize = new URL(opened[0]);
  assert.equal(authorize.origin, "https://auth.example");
  assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorize.searchParams.get("client_id"), "inout-mobile");
  assert.equal(calls[0].body.grant_type, "authorization_code");
  assert.equal(calls[0].body.redirect_uri, "inout://auth/callback");
  assert.equal("client_secret" in calls[0].body, false);
  const expected = createHash("sha256").update(calls[0].body.code_verifier).digest();
  assert.equal(
    Buffer.from(expected).toString("base64url"),
    authorize.searchParams.get("code_challenge"),
  );
});

test("refresh replaces the access token and a failed refresh drops the session", async () => {
  const storage = memory();
  await storage.setItem(
    "inout.openid.session",
    JSON.stringify({ accessToken: "old", refreshToken: "refresh", expiresAt: 0 }),
  );
  let refreshed = false;
  const { repo, calls } = repository((request) => {
    if (request.url.endsWith("/connect/token")) {
      refreshed = true;
      return { body: { access_token: "new", refresh_token: "next", expires_in: 600 } };
    }
    return { body: { sub: "user-1", email: "a@b.com", email_verified: "true" } };
  }, storage);
  const session = createOpenIdSession(repo);
  const first = await session.auth.getSession();
  assert.equal(first.data.session.access_token, "new");
  assert.equal(first.data.session.user.id, "user-1");
  assert.equal(calls[0].body.grant_type, "refresh_token");
  assert.equal(refreshed, true);
  const failing = repository(() => ({ status: 400, body: { error: "invalid_grant" } }), storage);
  await failing.storage.setItem(
    "inout.openid.session",
    JSON.stringify({ accessToken: "old", refreshToken: "refresh", expiresAt: 0 }),
  );
  assert.equal((await createOpenIdSession(failing.repo).auth.getSession()).data.session, null);
});

test("local logout revokes tokens without opening the hosted session, sso does", async () => {
  const storage = memory();
  await storage.setItem(
    "inout.openid.session",
    JSON.stringify({ accessToken: "access", refreshToken: "refresh", expiresAt: Date.now() + 60_000 }),
  );
  const local = repository(() => ({ body: {} }), storage);
  await local.repo.signOut("local");
  assert.equal(local.opened.length, 0);
  assert.equal(
    local.calls.some((item) => String(item.url).endsWith("/connect/revoke")),
    true,
  );
  await storage.setItem(
    "inout.openid.session",
    JSON.stringify({ accessToken: "access", refreshToken: "refresh", expiresAt: Date.now() + 60_000 }),
  );
  const sso = repository(() => ({ body: {} }), storage);
  await sso.repo.signOut("sso");
  assert.equal(
    sso.opened.some((url) => String(url).includes("/connect/logout")),
    true,
  );
});

test("hosted account pages are an exact allowlist", async () => {
  const { service, opened } = repository(() => ({ body: {} }));
  await service.openHostedAccount("/account/register");
  assert.equal(opened[0], "https://auth.example/account/register");
  await assert.rejects(service.openHostedAccount("https://evil.example"), AuthFailure);
  await assert.rejects(service.openHostedAccount("/account/../admin"), AuthFailure);
});

test("authorization callback requires matching state, age, and one-time use", async () => {
  const used = new Set();
  const pending = {
    verifier: "verifier",
    state: "state-1",
    redirectUri: "inout://auth/callback",
    createdAt: 0,
  };
  const completed = await completeAuthorizationCallback({
    url: "inout://auth/callback?code=code-1&state=state-1",
    expectedRedirectUri: "inout://auth/callback",
    pending,
    now: () => 1,
    markUsed: async (state) => {
      if (used.has(state)) return true;
      used.add(state);
      return false;
    },
  });
  assert.equal(completed.code, "code-1");
  await assert.rejects(
    () =>
      completeAuthorizationCallback({
        url: "inout://auth/callback?code=code-1&state=state-1",
        expectedRedirectUri: "inout://auth/callback",
        pending,
        now: () => 1,
        markUsed: async (state) => used.has(state),
      }),
    AuthFailure,
  );
  await assert.rejects(
    () =>
      completeAuthorizationCallback({
        url: "inout://auth/callback?code=code-1&state=other",
        expectedRedirectUri: "inout://auth/callback",
        pending,
        now: () => 1,
        markUsed: async () => false,
      }),
    AuthFailure,
  );
  await assert.rejects(
    () =>
      completeAuthorizationCallback({
        url: "inout://auth/callback?code=code-1&state=state-1",
        expectedRedirectUri: "inout://auth/callback",
        pending,
        now: () => 11 * 60 * 1000,
        markUsed: async () => false,
      }),
    AuthFailure,
  );
});
