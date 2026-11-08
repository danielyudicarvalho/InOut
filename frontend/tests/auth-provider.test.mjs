import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { open, seal, sessionKey } from "../lib/auth/session-cookie.ts";

test("web composition has no hosted auth SDK and the session cookie hides tokens", () => {
  const composition = readFileSync(
    new URL("../lib/auth/composition.ts", import.meta.url),
    "utf8",
  );
  assert.equal(composition.includes("supabase"), false);
  assert.equal(composition.includes("access_token: current.csrf"), true);
  const key = sessionKey({ NODE_ENV: "test" });
  const sealed = seal(
    {
      accessToken: "server-access",
      refreshToken: "server-refresh",
      expiresAt: 1,
      csrf: "csrf-value",
      user: { id: "user", email: "a@b.com", emailConfirmed: true },
    },
    key,
  );
  assert.equal(sealed.includes("server-access"), false);
  assert.equal(open(sealed, key)?.csrf, "csrf-value");
  assert.equal(
    open(
      sealed,
      sessionKey({
        NODE_ENV: "production",
        BFF_SESSION_KEY: Buffer.alloc(32, 7).toString("base64"),
      }),
    ),
    null,
  );
});
