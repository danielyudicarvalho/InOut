import test from "node:test";
import assert from "node:assert/strict";
import { createFinanceRepository } from "./index.mjs";
const facts = { incomeCents: 1200, expenseCents: 400, resultCents: 800 };
const payload = {
  from: "2026-10-01",
  to: "2026-10-31",
  previousFrom: "2026-09-01",
  previousTo: "2026-09-30",
  currency: "BRL",
  isReconciled: true,
  current: facts,
  previous: facts,
  changes: [
    {
      kind: "income",
      id: null,
      name: "Receitas",
      currentCents: 1200,
      previousCents: 0,
      deltaCents: 1200,
      percentageChange: null,
    },
  ],
  series: [{ from: "2026-10-01", to: "2026-10-31", ...facts }],
  accounts: [],
};
test("analysis sends authorized household, currency and bounds and preserves undefined percentage", async () => {
  let request;
  const repo = createFinanceRepository({
    baseUrl: "https://api.example.test",
    getToken: async () => "token",
    fetcher: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify(payload));
    },
  });
  const result = await repo.analysis("home", "2026-10", "BRL");
  assert.match(request.url, /households\/home\/ledger\/analysis/);
  const query = new URL(request.url).searchParams;
  assert.equal(query.get("from"), "2026-10-01");
  assert.equal(query.get("to"), "2026-10-31");
  assert.equal(query.get("currency"), "BRL");
  assert.equal(request.init.headers.Authorization, "Bearer token");
  assert.equal(result.current.resultCents, 800);
  assert.equal(result.changes[0].percentageChange, null);
});
test("analysis rejects wrong period or unsafe amounts", async () => {
  for (const invalid of [
    { ...payload, to: "2026-11-01" },
    {
      ...payload,
      current: { ...facts, incomeCents: Number.MAX_SAFE_INTEGER + 1 },
    },
  ]) {
    const repo = createFinanceRepository({
      baseUrl: "https://api.example.test",
      getToken: async () => "token",
      fetcher: async () => new Response(JSON.stringify(invalid)),
    });
    await assert.rejects(repo.analysis("home", "2026-10", "BRL"), {
      code: "invalid",
    });
  }
});
