import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinanceRepository,
  getDuplicateComparison,
  createDuplicateResolutionStore,
  shortTransactionId,
} from "./index.mjs";

const t1Id = "d6b5efbd-1cda-4818-84c7-a682e1078042";
const t2Id = "086a756c-f66f-48c2-97cb-4b6ce6f98043";

const t1Row = {
  transactionId: t1Id,
  kind: "expense",
  status: "posted",
  description: "Compras da semana",
  reversalOf: null,
  occurredOn: "2026-10-28",
  postedAt: "2026-10-28T10:42:00Z",
  createdBy: "Daniel Yudi",
  accountId: "acc-1",
  accountName: "Conta principal",
  categoryId: "child",
  categoryName: "Mercado",
  direction: "debit",
  amountCents: 32000,
  currency: "BRL",
};

const t2Row = {
  transactionId: t2Id,
  kind: "expense",
  status: "posted",
  description: "Compras da semana",
  reversalOf: null,
  occurredOn: "2026-10-28",
  postedAt: "2026-10-28T10:45:00Z",
  createdBy: "Ana",
  accountId: "acc-1",
  accountName: "Conta principal",
  categoryId: "child",
  categoryName: "Mercado",
  direction: "debit",
  amountCents: 32000,
  currency: "BRL",
};

function createMockRepo(allRows = [t1Row, t2Row]) {
  return createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url) => {
      if (url.endsWith("/households")) {
        return new Response(JSON.stringify([{ id: "h", name: "Casa" }]));
      }
      if (url.includes("/categories?")) {
        return new Response(
          JSON.stringify([
            { id: "root", name: "Alimentação" },
            { id: "child", name: "Mercado", parentId: "root" },
          ]),
        );
      }
      if (url.includes("/history?")) {
        const u = new URL(url);
        const txId = u.searchParams.get("transactionId");
        if (txId) {
          const matched = allRows.filter((r) => r.transactionId === txId);
          return new Response(JSON.stringify(matched));
        }
        return new Response(JSON.stringify(allRows));
      }
      return new Response(JSON.stringify([]));
    },
  });
}

test("shortTransactionId formats short reference labels cleanly", () => {
  assert.equal(shortTransactionId("LAN-0042"), "LAN-0042");
  assert.equal(shortTransactionId("d6b5efbd-1cda-4818-84c7-a682e1078042"), "LAN-8042");
});

test("getDuplicateComparison loads two records and auto-suggests second for reversal", async () => {
  const repo = createMockRepo();
  const comparison = await getDuplicateComparison(repo, "h", t1Id, t2Id);

  assert.equal(comparison.first.displayId, "LAN-8042");
  assert.equal(comparison.first.description, "Compras da semana");
  assert.equal(comparison.first.amount, -32000);
  assert.equal(comparison.first.accountName, "Conta principal");
  assert.equal(comparison.first.createdBy, "Daniel Yudi");

  assert.equal(comparison.second.displayId, "LAN-8043");
  assert.equal(comparison.second.description, "Compras da semana");
  assert.equal(comparison.second.amount, -32000);
  assert.equal(comparison.second.createdBy, "Ana");

  assert.equal(comparison.suggestedToReverseId, t2Id);
});

test("createDuplicateResolutionStore manages selection and state", async () => {
  const repo = createMockRepo();
  const store = createDuplicateResolutionStore(repo, "h", t1Id, t2Id);
  store.start();
  await new Promise((r) => setTimeout(r, 40));

  const snap = store.getSnapshot();
  assert.equal(snap.status, "ready");
  assert.equal(snap.selectedId, t2Id);

  store.select(t1Id);
  assert.equal(store.getSnapshot().selectedId, t1Id);
});
