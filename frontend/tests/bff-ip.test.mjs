import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  bffIpKey,
  clientIpFromRequest,
  signedClientIpHeaders,
} from "../lib/auth/bff-ip.ts";

test("production BFF refuses to start without BFF_IP_KEY and never reads x-real-ip", () => {
  assert.throws(
    () => bffIpKey({ NODE_ENV: "production" }),
    /BFF_IP_KEY is required in production/,
  );
  assert.equal(bffIpKey({ NODE_ENV: "test" }), "");
  const request = new Request("http://localhost/api/auth/login", {
    headers: {
      "x-real-ip": "198.51.100.9",
      "fly-client-ip": "203.0.113.10",
    },
  });
  assert.equal(clientIpFromRequest(request), "203.0.113.10");
  assert.equal(
    clientIpFromRequest(
      new Request("http://localhost/api/auth/login", {
        headers: { "x-real-ip": "198.51.100.9" },
      }),
    ),
    "",
  );
});

test("signed client IP MAC includes timestamp and nonce", () => {
  const headers = signedClientIpHeaders(
    "203.0.113.10",
    "bff-ip-key",
    1_700_000_000_000,
  );
  assert.equal(headers["x-inout-client-ip"], "203.0.113.10");
  assert.equal(headers["x-inout-client-ip-ts"], "1700000000");
  assert.match(headers["x-inout-client-ip-nonce"], /^[0-9a-f]{32}$/);
  const expected = createHmac("sha256", "bff-ip-key")
    .update(
      `203.0.113.10\n${headers["x-inout-client-ip-ts"]}\n${headers["x-inout-client-ip-nonce"]}`,
    )
    .digest("hex");
  assert.equal(headers["x-inout-client-ip-mac"], expected);
  assert.deepEqual(signedClientIpHeaders("203.0.113.10", ""), {});
});
