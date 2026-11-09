import test from "node:test";
import assert from "node:assert/strict";
import {
  open,
  seal,
  sessionKey,
  verifySameOrigin,
} from "../lib/auth/session-cookie.ts";

test("production refuses an ephemeral session key and tampering fails closed", () => {
  assert.throws(() => sessionKey({ NODE_ENV: "production" }));
  const key = Buffer.alloc(32, 3);
  const sealed = seal(
    {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 1,
      csrf: "c",
      user: null,
    },
    key,
  );
  const parts = sealed.split(".");
  parts[2] = Buffer.from("tampered").toString("base64url");
  assert.equal(open(parts.join("."), key), null);
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
