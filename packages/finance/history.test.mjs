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

test("filter draft restores hierarchy without mutating applied filters and removes incompatible income source", async () => {
  const { historyDraft, applyHistoryDraft } = await import("./index.mjs");
  const catalog = {
    accounts: [],
    sources: [],
    categories: [
      { id: "root", name: "Casa", parentId: null, flow: "expense" },
      { id: "child", name: "Luz", parentId: "root", flow: "expense" },
    ],
  };
  const applied = {
    kind: "expense",
    categoryId: "child",
    incomeSourceId: "stale",
  };
  const draft = historyDraft("2026-10", applied, catalog);
  assert.equal(draft.parentId, "root");
  assert.equal(draft.subcategoryId, "child");
  draft.search = "  energia  ";
  assert.equal(applied.search, undefined);
  const next = applyHistoryDraft(draft);
  assert.equal(next.filters.categoryId, "child");
  assert.equal(next.filters.includeSubcategories, false);
  assert.equal(next.filters.incomeSourceId, "");
  assert.equal(next.filters.search, "energia");
  const parent = applyHistoryDraft({ ...draft, subcategoryId: "" });
  assert.equal(parent.filters.categoryId, "root");
  assert.equal(parent.filters.includeSubcategories, true);
});
test("filter drafts validate real inclusive dates before applying and retain source only for income", async () => {
  const { applyHistoryDraft } = await import("./index.mjs");
  const draft = {
    from: "2026-10-01",
    to: "2026-10-31",
    parentId: "",
    subcategoryId: "",
    kind: "income",
    incomeSourceId: "salary",
  };
  assert.equal(applyHistoryDraft(draft).filters.incomeSourceId, "salary");
  for (const invalid of [
    { ...draft, from: "2026-11-01" },
    { ...draft, to: "2026-02-30" },
  ])
    assert.throws(() => applyHistoryDraft(invalid), { code: "period" });
});
test("history forwards category family and income-source filters to the backend", async () => {
  const calls = [];
  await repository([], calls).ledgerHistory("h", "2026-10", {
    categoryId: "root",
    includeSubcategories: true,
    incomeSourceId: "salary",
  });
  const url = new URL(calls[1]);
  assert.equal(url.searchParams.get("categoryId"), "root");
  assert.equal(url.searchParams.get("includeSubcategories"), "true");
  assert.equal(url.searchParams.get("incomeSourceId"), "salary");
});
test("filter catalogs are authorized first and include archived historical classification", async () => {
  const calls = [];
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "token",
    fetcher: async (url) => {
      calls.push(url);
      let rows = [];
      if (url.endsWith("/households")) rows = [{ id: "h", name: "Casa" }];
      if (url.includes("/categories?"))
        rows = [
          {
            id: "old",
            name: "Antiga",
            flow: "expense",
            parentId: "root",
            archivedAt: "2026-01-01",
          },
        ];
      return new Response(JSON.stringify(rows));
    },
  });
  const options = await repo.historyOptions("h");
  assert.equal(options.categories[0].parentId, "root");
  assert.equal(
    calls.filter((u) => u.includes("includeArchived=true")).length,
    3,
  );
  const unauthorized = [];
  await assert.rejects(
    repository([], unauthorized, []).historyOptions("other"),
    { code: "forbidden" },
  );
  assert.equal(unauthorized.length, 1);
});

test("saved-record links query the exact transaction identifier within the authorized household and period", async () => {
  const id = "bd9c216f-c566-48a3-9c3d-fec8a6fd771a",
    calls = [];
  const page = await repository(
    [{ ...row, transactionId: id }],
    calls,
  ).ledgerHistory("h", "2026-10", { transactionId: id });
  const url = new URL(calls[1]);
  assert.equal(url.searchParams.get("transactionId"), id);
  assert.equal(url.searchParams.get("from"), "2026-10-01");
  assert.equal(page.items[0].transactionId, id);
  const denied = [];
  await assert.rejects(
    repository([], denied, []).ledgerHistory("other", "2026-10", {
      transactionId: id,
    }),
    { code: "forbidden" },
  );
  assert.equal(denied.length, 1);
});

test("an ignored transaction filter never displays another record as the saved transaction", async () => {
  await assert.rejects(
    repository([row], []).ledgerHistory("h", "2026-10", {
      transactionId: "bd9c216f-c566-48a3-9c3d-fec8a6fd771a",
    }),
    { code: "invalid" },
  );
});
