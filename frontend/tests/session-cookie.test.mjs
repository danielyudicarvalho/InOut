import test from "node:test";
import assert from "node:assert/strict";
import { open, seal, sessionKey } from "../lib/auth/session-cookie.ts";

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
