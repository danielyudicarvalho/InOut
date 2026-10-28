import test from "node:test";
import assert from "node:assert/strict";
import { createFinanceRepository, historyKind } from "./index.mjs";
function repository(rows, calls, homes = [{ id: "h", name: "Casa" }]) {
  return createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "token",
    fetcher: async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify(url.endsWith("/households") ? homes : rows),
      );
    },
  });
}
const row = {
  transactionId: "t",
  accountId: "a",
  accountName: "Conta",
  kind: "expense",
  status: "reversed",
  description: "Luz",
  occurredOn: "2026-10-10",
  direction: "debit",
  amountCents: 15000,
  currency: "BRL",
  categoryName: "Energia",
  incomeSourceName: null,
  reversalOf: null,
};
test("history sends inclusive dates, filters and offset and keeps the lookahead out of the page", async () => {
  const calls = [];
  const page = await repository(
    Array.from({ length: 51 }, (_, i) => ({
      ...row,
      transactionId: String(i),
    })),
    calls,
  ).ledgerHistory(
    "h",
    "2026-10",
    { search: "luz & água", kind: "expense", accountId: "a" },
    50,
  );
  const url = new URL(calls[1]);
  assert.equal(url.searchParams.get("from"), "2026-10-01");
  assert.equal(url.searchParams.get("to"), "2026-10-31");
  assert.equal(url.searchParams.get("search"), "luz & água");
  assert.equal(url.searchParams.get("offset"), "50");
  assert.equal(url.searchParams.get("limit"), "51");
  assert.equal(page.items.length, 50);
  assert.equal(page.hasMore, true);
  assert.equal(page.items[0].amount, -15000);
  assert.equal(page.items[0].status, "reversed");
});
test("history preserves transfer legs and reversal links in their account currencies", async () => {
  const page = await repository(
    [
      { ...row, kind: "transfer", status: "posted" },
      { ...row, kind: "transfer", accountId: "b", direction: "credit" },
      {
        ...row,
        kind: "reversal",
        direction: "credit",
        reversalOf: "original",
        currency: "USD",
      },
    ],
    [],
  ).ledgerHistory("h", "2026-10", {});
  assert.deepEqual(
    page.items.map((i) => i.amount),
    [-15000, 15000, 15000],
  );
  assert.equal(page.items[2].reversalOf, "original");
  assert.equal(page.items[2].currency, "USD");
  assert.equal(historyKind(page.items[2]), "Estorno");
  assert.equal(page.hasMore, false);
});
test("history never queries an unauthorized household and accepts an empty real result", async () => {
  const calls = [];
  await assert.rejects(
    repository([], calls, []).ledgerHistory("foreign", "2026-10"),
    { code: "forbidden" },
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(await repository([], []).ledgerHistory("h", "2026-10"), {
    items: [],
    hasMore: false,
  });
});
test("history rejects corrupt directions and negative unsigned cents", async () => {
  for (const invalid of [
    { ...row, direction: "invalid" },
    { ...row, amountCents: -1 },
  ])
    await assert.rejects(
      repository([invalid], []).ledgerHistory("h", "2026-10"),
      { code: "invalid" },
    );
});
