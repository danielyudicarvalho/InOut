import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  openSessionId,
  sealSessionId,
  sessionKey,
} from "../lib/auth/session-cookie.ts";

test("web composition has no hosted auth SDK and the session cookie hides tokens", () => {
  const composition = readFileSync(
    new URL("../lib/auth/composition.ts", import.meta.url),
    "utf8",
  );
  assert.equal(composition.includes("supabase"), false);
  assert.equal(composition.includes("access_token: current.csrf"), true);
  const key = sessionKey({ NODE_ENV: "test" });
  const sealed = sealSessionId("opaque-session-id", key);
  assert.equal(sealed.includes("server-access"), false);
  assert.equal(sealed.includes("refresh"), false);
  assert.equal(openSessionId(sealed, [key]), "opaque-session-id");
  assert.equal(
    openSessionId(sealed, [
      sessionKey({
        NODE_ENV: "production",
        BFF_SESSION_KEY: Buffer.alloc(32, 7).toString("base64"),
      }),
    ]),
    null,
  );
});
