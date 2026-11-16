import test from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../lib/auth/safe-next.ts";

test("safeNextPath allows same-origin relative paths only", () => {
  assert.equal(safeNextPath("/inicio"), "/inicio");
  assert.equal(safeNextPath("/inicio?tab=1"), "/inicio?tab=1");
  assert.equal(safeNextPath("https://evil.com"), null);
  assert.equal(safeNextPath("//evil.com"), null);
  assert.equal(safeNextPath("/\\evil.com"), null);
  assert.equal(safeNextPath("\\evil.com"), null);
  assert.equal(safeNextPath("/\\/evil.com"), null);
  assert.equal(safeNextPath("https:evil.com"), null);
  assert.equal(safeNextPath("/http://evil.com"), null);
  assert.equal(safeNextPath(""), null);
  assert.equal(safeNextPath(null), null);
  assert.equal(safeNextPath("/\t/evil.com"), null);
  assert.equal(safeNextPath("/\n/evil.com"), null);
  assert.equal(safeNextPath("/%09/evil.com"), null);
  assert.equal(safeNextPath("/%0a/evil.com"), null);
  assert.equal(safeNextPath("/inicio%5c/evil.com"), null);
  assert.equal(safeNextPath("//evil.com/path"), null);
});
