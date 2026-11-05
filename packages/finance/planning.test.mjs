import assert from "node:assert/strict";
import test from "node:test";
import { FinanceFailure, parseMoneyInput } from "./index.mjs";

test("parseMoneyInput reads reais with a comma or dot", () => {
  assert.equal(parseMoneyInput("150,00"), 15000);
  assert.equal(parseMoneyInput("1.5"), 150);
  assert.throws(() => parseMoneyInput("0"), FinanceFailure);
  assert.throws(() => parseMoneyInput("1,234"), FinanceFailure);
});
