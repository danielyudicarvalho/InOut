import test from "node:test";
import assert from "node:assert/strict";
import {
  csrfCookieName,
  openSessionId,
  sealSessionId,
  sessionCookieName,
  sessionKey,
  verifySameOrigin,
} from "../lib/auth/session-cookie.ts";

test("production session cookies use the __Host- prefix", () => {
  assert.equal(
    sessionCookieName({ NODE_ENV: "production" }),
    "__Host-inout_session",
  );
  assert.equal(csrfCookieName({ NODE_ENV: "production" }), "__Host-inout_csrf");
  assert.equal(sessionCookieName({ NODE_ENV: "test" }), "inout_session");
});

test("production refuses an ephemeral session key and tampering fails closed", () => {
  assert.throws(() => sessionKey({ NODE_ENV: "production" }));
  const key = Buffer.alloc(32, 3);
  const sealed = sealSessionId("session-1", key);
  const parts = sealed.split(".");
  parts[1] = Buffer.from("tampered").toString("base64url");
  assert.equal(openSessionId(parts.join("."), [key]), null);
  assert.equal(openSessionId(sealed, [key]), "session-1");
});

test("verifySameOrigin rejects cross-site requests and mismatched origins", () => {
  const crossSite = new Request("http://localhost:3000/api/auth/logout", {
    headers: { "sec-fetch-site": "cross-site" },
  });
  assert.equal(verifySameOrigin(crossSite), false);

  const mismatchedOrigin = new Request(
    "http://localhost:3000/api/auth/logout",
    {
      headers: { host: "localhost:3000", origin: "https://evil.com" },
    },
  );
  assert.equal(verifySameOrigin(mismatchedOrigin), false);

  const validSameOrigin = new Request("http://localhost:3000/api/auth/logout", {
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
    },
  });
  assert.equal(verifySameOrigin(validSameOrigin), true);
});
