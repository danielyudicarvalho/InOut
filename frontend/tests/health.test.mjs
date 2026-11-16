import test from "node:test";
import assert from "node:assert/strict";
import { healthStatus } from "../lib/auth/health-status.ts";

test("health is not-ready when API_BASE_URL is unset", () => {
  const missing = healthStatus(undefined);
  assert.equal(missing.status, "not-ready");
  assert.equal(missing.httpStatus, 503);
  assert.equal(healthStatus("http://api.example").status, "ready");
});
