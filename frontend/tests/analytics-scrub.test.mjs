import test from "node:test";
import assert from "node:assert/strict";
import { scrubProperties, scrubUrl } from "../lib/analytics/scrub.ts";

test("scrubUrl drops auth codes and e-mail from callback links", () => {
  assert.equal(
    scrubUrl("https://app.example/auth/callback?email=a%40b.c&code=123456"),
    "https://app.example/auth/callback",
  );
  assert.equal(
    scrubUrl("http://localhost:3000/auth/recuperar?code=9#frag"),
    "http://localhost:3000/auth/recuperar",
  );
});

test("scrubUrl leaves non-URL values untouched", () => {
  assert.equal(scrubUrl("/lancamentos"), "/lancamentos");
  assert.equal(scrubUrl("plain text ?x=1"), "plain text ?x=1");
});

test("scrubProperties cleans every URL-valued property", () => {
  const clean = scrubProperties({
    $current_url: "https://app.example/auth/callback?code=1",
    $referrer: "https://mail.example/?token=secret",
    $pathname: "/auth/callback",
    count: 3,
  });
  assert.deepEqual(clean, {
    $current_url: "https://app.example/auth/callback",
    $referrer: "https://mail.example/",
    $pathname: "/auth/callback",
    count: 3,
  });
  assert.equal(scrubProperties(undefined), undefined);
});
