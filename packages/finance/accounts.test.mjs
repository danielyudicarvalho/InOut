import test from "node:test";
import assert from "node:assert/strict";
import { groupAccounts, createAccountsRepository } from "./accounts.mjs";
const rows = [
  {
    id: "1",
    name: "Principal",
    kind: "Checking",
    currency: "BRL",
    balance: 100,
    archivedAt: null,
  },
  {
    id: "2",
    name: "Dólar",
    kind: "Cash",
    currency: "USD",
    balance: 200,
    archivedAt: null,
  },
  {
    id: "3",
    name: "Antiga",
    kind: "Cash",
    currency: "BRL",
    balance: 300,
    archivedAt: "2026-01-01",
  },
];
test("separates currencies and excludes archived balances from active totals", () => {
  assert.deepEqual(
    groupAccounts(rows).map((g) => [g.currency, g.balance]),
    [
      ["BRL", 100],
      ["USD", 200],
    ],
  );
  assert.equal(groupAccounts(rows, { archived: true })[0].balance, 300);
  assert.equal(groupAccounts(rows, { search: "PRINC" })[0].accounts[0].id, "1");
});
test("uses real ledger endpoints and restricts metadata payload", async () => {
  const calls = [];
  const repo = createAccountsRepository({
    baseUrl: "https://example.test",
    getToken: async () => "token",
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: options.method === "DELETE" ? 204 : 200,
        json: async () => rows.map((r) => ({ ...r, balanceCents: r.balance })),
      };
    },
  });
  assert.equal((await repo.list("home")).length, 3);
  await repo.edit("home", "1", " Nome ", "cash");
  await repo.archive("home", "1");
  assert.match(calls[0].url, /includeArchived=true/);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    name: "Nome",
    kind: "cash",
  });
  assert.equal(calls[2].options.method, "DELETE");
  await assert.rejects(repo.edit("home", "1", "", "cash"));
});
test("rejects corrupt monetary values", async () => {
  const repo = createAccountsRepository({
    baseUrl: "https://example.test",
    getToken: async () => "x",
    fetcher: async () => ({
      ok: true,
      status: 200,
      json: async () => [{ ...rows[0], balanceCents: 1.5 }],
    }),
  });
  await assert.rejects(repo.list("home"));
});
