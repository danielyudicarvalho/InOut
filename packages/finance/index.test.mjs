import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinanceRepository,
  createFinancialHomeStore,
  FinanceFailure,
  monthOptions,
  money,
} from "./index.mjs";
const json = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
const dashboard = (
  period = "2026-10",
  summaries = [
    {
      currency: "EUR",
      consolidatedBalanceCents: 12345,
      incomeCents: 5000,
      expenseCents: 1250,
      resultCents: 3750,
    },
  ],
) => ({
  periodStart: `${period}-01`,
  periodEnd: `${period}-31`,
  isReconciled: true,
  summaries,
  accounts: [
    {
      accountId: "account",
      accountName: "Conta",
      currency: "EUR",
      balanceCents: 12345,
      inflowCents: 5000,
      outflowCents: 1250,
      netChangeCents: 3750,
    },
  ],
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("authenticated endpoints, dynamic currencies and history entries use API values", async () => {
  const calls = [];
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "user-jwt",
    fetcher: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/households"))
        return json([{ id: "home", name: "Casa real" }]);
      if (url.endsWith("/accounts"))
        return json([{ id: "account", kind: "savings", balanceCents: 99999 }]);
      if (url.includes("/history?"))
        return json([
          {
            transactionId: "tx",
            accountId: "account",
            accountName: "Conta",
            description: "Compra",
            categoryName: "Mercado",
            direction: "debit",
            amountCents: 1250,
            currency: "EUR",
            kind: "expense",
            occurredOn: "2026-10-12",
          },
        ]);
      const u = new URL(url);
      return json(
        dashboard(
          `${u.searchParams.get("year")}-${String(u.searchParams.get("month")).padStart(2, "0")}`,
        ),
      );
    },
  });
  assert.equal((await repo.households())[0].name, "Casa real");
  const data = await repo.home("home", "2026-10");
  assert.deepEqual(data.currencies, ["EUR"]);
  assert.equal(data.summaries[0].balance, 12345);
  assert.equal(data.summaries[0].result, 3750);
  assert.equal(data.transactions[0].cents, -1250);
  assert.equal(data.history.length, 6);
  assert.equal(calls.length, 9);
  assert.equal(data.accounts[0].balance, 12345);
  assert.equal(data.accounts[0].kind, "savings");
  assert.ok(
    calls.every(
      (c) =>
        c.options.headers.Authorization === "Bearer user-jwt" &&
        c.options.cache === "no-store" &&
        c.options.redirect === "error",
    ),
  );
  assert.ok(
    calls.some((c) =>
      c.url.endsWith("/history?from=2026-10-01&to=2026-10-31&limit=20"),
    ),
  );
});
test("missing configuration or credentials never requests data", async () => {
  let calls = 0;
  const fetcher = () => {
    calls++;
    throw Error();
  };
  await assert.rejects(
    createFinanceRepository({
      baseUrl: undefined,
      getToken: async () => "jwt",
      fetcher,
    }).households(),
    (e) => e.code === "configuration",
  );
  await assert.rejects(
    createFinanceRepository({
      baseUrl: "https://api.example",
      getToken: async () => null,
      fetcher,
    }).households(),
    (e) => e.code === "unauthorized",
  );
  assert.equal(calls, 0);
});
test("HTTP errors and malformed monetary data fail closed without fixture fallback", async () => {
  for (const [status, code] of [
    [401, "unauthorized"],
    [403, "forbidden"],
    [500, "server"],
  ]) {
    const repo = createFinanceRepository({
      baseUrl: "https://api.example",
      getToken: async () => "jwt",
      fetcher: async () => new Response("", { status }),
    });
    await assert.rejects(repo.households(), (e) => e.code === code);
  }
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url) =>
      url.includes("history")
        ? json([])
        : json(
            dashboard("2026-10", [
              {
                currency: "BRL",
                consolidatedBalanceCents: Number.MAX_SAFE_INTEGER + 1,
                incomeCents: 0,
                expenseCents: 0,
                resultCents: 0,
              },
            ]),
          ),
  });
  await assert.rejects(
    repo.home("home", "2026-10"),
    (e) => e.code === "invalid",
  );
});
test("empty membership never requests financial data", async () => {
  let queries = 0;
  const store = createFinancialHomeStore({
    households: async () => [],
    home: async () => {
      queries++;
    },
  });
  const stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().status, "empty");
  assert.equal(queries, 0);
  stop();
});
test("switching household clears old data and ignores an obsolete response", async () => {
  const pending = [];
  const store = createFinancialHomeStore({
    households: async () => [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    home: (id, period, signal) =>
      new Promise((resolve) => pending.push({ id, resolve, signal })),
  });
  const stop = store.start();
  await tick();
  store.selectHousehold("b");
  assert.equal(store.getSnapshot().data, null);
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ owner: "b" });
  await tick();
  pending[0].resolve({ owner: "a" });
  await tick();
  assert.equal(store.getSnapshot().data.owner, "b");
  stop();
});
test("forbidden clears access, retry reloads membership", async () => {
  let fail = true,
    lists = 0;
  const store = createFinancialHomeStore({
    households: async () => {
      lists++;
      return [{ id: "a", name: "A" }];
    },
    home: async () => {
      if (fail) throw new FinanceFailure("forbidden");
      return { ok: true };
    },
  });
  const stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().status, "error");
  assert.equal(store.getSnapshot().households.length, 0);
  fail = false;
  store.retry();
  await tick();
  assert.equal(store.getSnapshot().status, "ready");
  assert.equal(lists, 2);
  stop();
});
test("timeout, cleanup and late responses cannot expose stale data", async () => {
  let resolve;
  const store = createFinancialHomeStore(
    {
      households: async () => [{ id: "a", name: "A" }],
      home: () => new Promise((r) => (resolve = r)),
    },
    { timeoutMs: 10 },
  );
  const stop = store.start();
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(store.getSnapshot().status, "error");
  resolve({ old: true });
  await tick();
  assert.equal(store.getSnapshot().data, null);
  stop();
});
test("period changes across years use calendar months and isolate requests", async () => {
  assert.deepEqual(monthOptions(new Date(2027, 0, 15)).slice(-2), [
    "2026-12",
    "2027-01",
  ]);
  const periods = [];
  const store = createFinancialHomeStore(
    {
      households: async () => [{ id: "a", name: "A" }],
      home: async (id, period) => {
        periods.push(period);
        return { period };
      },
    },
    { now: new Date(2027, 0, 15) },
  );
  const stop = store.start();
  await tick();
  store.selectPeriod("2026-12");
  assert.equal(store.getSnapshot().data, null);
  await tick();
  assert.deepEqual(periods, ["2027-01", "2026-12"]);
  assert.equal(store.getSnapshot().data.period, "2026-12");
  stop();
});

test("monetary formatting retains exact cents and negative sub-unit amounts", () => {
  assert.match(
    money(Number.MAX_SAFE_INTEGER, "BRL"),
    /90\.071\.992\.547\.409,91/,
  );
  assert.match(money(-25, "BRL"), /^-R\$.*0,25$/);
  assert.match(money(1, "USD"), /0,01$/);
});

test("custom range validates real calendar dates, ordering and one-day intervals", async () => {
  const { rangePeriod, parsePeriod } = await import("./index.mjs");
  assert.equal(
    rangePeriod("2024-02-29", "2024-02-29"),
    "2024-02-29/2024-02-29",
  );
  for (const [a, b] of [
    ["2023-02-29", "2023-03-01"],
    ["2026-04-31", "2026-05-01"],
    ["2026-10-20", "2026-10-05"],
    ["", "2026-10-05"],
  ])
    assert.throws(
      () => rangePeriod(a, b),
      (e) => e.code === "period",
    );
  assert.equal(parsePeriod("2026-10").to, "2026-10-31");
});
test("presets and calendar handle year transitions and Monday-aligned dates", async () => {
  const { presetPeriod, calendarDays } = await import("./index.mjs");
  const now = new Date(2027, 0, 10);
  assert.equal(presetPeriod("previous", now), "2026-12");
  assert.equal(presetPeriod("quarter", now), "2026-11-01/2027-01-31");
  const days = calendarDays("2026-10");
  assert.equal(days[0], null);
  assert.equal(days[3], "2026-10-01");
  assert.equal(days.filter(Boolean).length, 31);
});
test("custom selection sends exact inclusive bounds to dashboard and history", async () => {
  const calls = [];
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url) => {
      calls.push(url);
      return url.endsWith("/accounts")
        ? json([{ id: "account", kind: "checking" }])
        : url.includes("/history?")
          ? json([])
          : json({
              ...dashboard(),
              periodStart: "2026-10-05",
              periodEnd: "2026-10-20",
            });
    },
  });
  const data = await repo.home("a", "2026-10-05/2026-10-20");
  assert.equal(data.history.length, 1);
  assert.equal(data.periodEnd, "2026-10-20");
  assert.ok(
    calls.includes(
      "https://api.example/api/v1/households/a/ledger/dashboard?from=2026-10-05&to=2026-10-20",
    ),
  );
  assert.ok(
    calls.includes(
      "https://api.example/api/v1/households/a/ledger/history?from=2026-10-05&to=2026-10-20&limit=20",
    ),
  );
});
test("store accepts a custom period and refuses invalid intervals without new requests", async () => {
  const calls = [];
  const store = createFinancialHomeStore({
    households: async () => [{ id: "a", name: "A" }],
    home: async (id, period) => {
      calls.push(period);
      return {};
    },
  });
  const stop = store.start();
  await tick();
  store.selectPeriod("2026-10-20/2026-10-05");
  await tick();
  assert.equal(calls.length, 1);
  store.selectPeriod("2026-10-05/2026-10-20");
  assert.equal(store.getSnapshot().data, null);
  await tick();
  assert.equal(calls[1], "2026-10-05/2026-10-20");
  stop();
});

test("balance composition isolates currencies and retains signed percentages", async () => {
  const { balanceComposition } = await import("./index.mjs");
  const home = {
    summaries: [
      { currency: "BRL", balance: 800 },
      { currency: "USD", balance: 500 },
    ],
    accounts: [
      { id: "cash", currency: "BRL", balance: 1000 },
      { id: "debt", currency: "BRL", balance: -200 },
      { id: "usd", currency: "USD", balance: 500 },
    ],
  };
  const value = balanceComposition(home, "BRL");
  assert.equal(value.accounts.length, 2);
  assert.equal(value.total, 800);
  assert.equal(value.matched, true);
  assert.equal(value.accounts[0].percent, 125);
  assert.equal(value.accounts[1].percent, -25);
  assert.ok(value.accounts[1].width > 0);
  assert.equal(balanceComposition(home, "USD").total, 500);
});
test("zero net balances have no misleading percentages and mismatches are exposed", async () => {
  const { balanceComposition } = await import("./index.mjs");
  const home = {
    summaries: [{ currency: "BRL", balance: 0 }],
    accounts: [
      { currency: "BRL", balance: 100 },
      { currency: "BRL", balance: -100 },
    ],
  };
  assert.equal(balanceComposition(home, "BRL").accounts[0].percent, null);
  home.summaries[0].balance = 1;
  assert.equal(balanceComposition(home, "BRL").matched, false);
});
test("composition sums integer cents exactly even when intermediate totals exceed safe number range", async () => {
  const { balanceComposition } = await import("./index.mjs");
  const max = Number.MAX_SAFE_INTEGER;
  const value = balanceComposition(
    {
      summaries: [{ currency: "BRL", balance: max }],
      accounts: [
        { currency: "BRL", balance: max },
        { currency: "BRL", balance: max },
        { currency: "BRL", balance: -max },
      ],
    },
    "BRL",
  );
  assert.equal(value.matched, true);
  assert.equal(value.total, max);
});
test("deep links retain authorized household and period, and never query an unauthorized identifier", async () => {
  let calls = [];
  const repo = {
    households: async () => [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    home: async (id, period) => {
      calls.push([id, period]);
      return {};
    },
  };
  const store = createFinancialHomeStore(repo, {
    initialHouseholdId: "b",
    initialPeriod: "2026-10-05/2026-10-20",
  });
  const stop = store.start();
  await tick();
  assert.deepEqual(calls, [["b", "2026-10-05/2026-10-20"]]);
  stop();
  calls = [];
  const denied = createFinancialHomeStore(repo, {
    initialHouseholdId: "foreign",
  });
  const cleanup = denied.start();
  await tick();
  assert.equal(denied.getSnapshot().status, "error");
  assert.equal(calls.length, 0);
  cleanup();
});

test("income detail requests exact range and validates signed real entries", async () => {
  let request;
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, options) => {
      request = { url, options };
      return json({
        periodStart: "2026-10-05",
        periodEnd: "2026-10-20",
        snapshotId: "A".repeat(64),
        currency: "EUR",
        totalCents: 3750,
        isReconciled: true,
        totalCount: 2,
        offset: 0,
        items: [
          {
            entryId: "e1",
            transactionId: "t1",
            accountId: "a",
            accountName: "Conta",
            occurredOn: "2026-10-10",
            description: "Receita",
            categoryName: "Trabalho",
            incomeSourceName: null,
            amountCents: 5000,
            isReversal: false,
            reversalOf: null,
          },
          {
            entryId: "e2",
            transactionId: "t2",
            accountId: "a",
            accountName: "Conta",
            occurredOn: "2026-10-11",
            description: null,
            categoryName: null,
            incomeSourceName: null,
            amountCents: -1250,
            isReversal: true,
            reversalOf: "t1",
          },
        ],
      });
    },
  });
  const data = await repo.income("home", "2026-10-05/2026-10-20", "EUR", 0);
  assert.equal(data.total, 3750);
  assert.equal(data.items[1].amount, -1250);
  assert.equal(data.items[1].isReversal, true);
  assert.equal(request.options.headers.Authorization, "Bearer jwt");
  assert.ok(
    request.url.endsWith(
      "/dashboard/income?currency=EUR&from=2026-10-05&to=2026-10-20&offset=0&limit=50",
    ),
  );
});
test("expense detail requests exact range and validates signed real entries", async () => {
  let request;
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, options) => {
      request = { url, options };
      return json({
        periodStart: "2026-10-05",
        periodEnd: "2026-10-20",
        snapshotId: "A".repeat(64),
        currency: "EUR",
        totalCents: 3750,
        isReconciled: true,
        totalCount: 2,
        offset: 0,
        items: [
          {
            entryId: "e1",
            transactionId: "t1",
            accountId: "a",
            accountName: "Conta",
            occurredOn: "2026-10-10",
            description: "Despesa",
            categoryName: "Trabalho",
            categoryId: "cat1",
            incomeSourceName: null,
            amountCents: 5000,
            isReversal: false,
            reversalOf: null,
          },
          {
            entryId: "e2",
            transactionId: "t2",
            accountId: "a",
            accountName: "Conta",
            occurredOn: "2026-10-11",
            description: null,
            categoryName: null,
            categoryId: null,
            incomeSourceName: null,
            amountCents: -1250,
            isReversal: true,
            reversalOf: "t1",
          },
        ],
      });
    },
  });
  const data = await repo.expense("home", "2026-10-05/2026-10-20", "EUR", 0);
  assert.equal(data.total, 3750);
  assert.equal(data.items[1].amount, -1250);
  assert.equal(data.items[1].isReversal, true);
  assert.equal(request.options.headers.Authorization, "Bearer jwt");
  assert.ok(
    request.url.endsWith(
      "/dashboard/expense?currency=EUR&from=2026-10-05&to=2026-10-20&offset=0&limit=50",
    ),
  );
});
test("income pages reject mismatched period and malformed reversal flags", async () => {
  const raw = {
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    snapshotId: "A".repeat(64),
    currency: "BRL",
    totalCents: 1,
    isReconciled: true,
    totalCount: 1,
    offset: 0,
    items: [
      {
        entryId: "e",
        transactionId: "t",
        accountId: "a",
        accountName: "Conta",
        occurredOn: "2026-10-11",
        amountCents: 1,
        isReversal: "false",
      },
    ],
  };
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async () => json(raw),
  });
  await assert.rejects(
    repo.income("home", "2026-10", "BRL", 0),
    (e) => e.code === "invalid",
  );
  raw.items[0].isReversal = false;
  raw.periodEnd = "2026-10-30";
  await assert.rejects(
    repo.income("home", "2026-10", "BRL", 0),
    (e) => e.code === "invalid",
  );
});
test("income detail pagination appends pages, detects changes and does not mix snapshots", async () => {
  const { createIncomeDetailsStore } = await import("./index.mjs");
  let change = false,
    calls = [];
  const page = (offset) => ({
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    snapshotId: "A".repeat(64),
    currency: "BRL",
    total: 3,
    totalCount: 2,
    offset,
    isReconciled: true,
    items: [{ id: `e${offset}`, amount: offset ? 2 : 1 }],
  });
  const repo = {
    income: async (id, period, currency, offset) => {
      calls.push(offset);
      const result = page(offset);
      if (change) result.snapshotId = "B".repeat(64);
      return result;
    },
  };
  const store = createIncomeDetailsStore(repo, "a", "2026-10", "BRL"),
    stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().data.items.length, 1);
  change = true;
  store.loadMore();
  await tick();
  assert.equal(store.getSnapshot().data.items.length, 1);
  assert.match(store.getSnapshot().notice, /mudaram/);
  change = false;
  store.loadMore();
  await tick();
  assert.equal(store.getSnapshot().data.items.length, 2);
  assert.deepEqual(calls, [0, 1, 1]);
  stop();
});
test("income detail unmount aborts and ignores late responses", async () => {
  const { createIncomeDetailsStore } = await import("./index.mjs");
  let resolve, signal;
  const store = createIncomeDetailsStore(
    {
      income: (id, p, c, o, s) => {
        signal = s;
        return new Promise((r) => (resolve = r));
      },
    },
    "a",
    "2026-10",
    "BRL",
  );
  const stop = store.start();
  stop();
  assert.equal(signal.aborted, true);
  resolve({ totalCount: 0, items: [] });
  await tick();
  assert.equal(store.getSnapshot().data, null);
});

test("income pagination clears financial data when access is revoked", async () => {
  const { createIncomeDetailsStore } = await import("./index.mjs");
  let calls = 0;
  const store = createIncomeDetailsStore(
    {
      income: async () => {
        if (++calls > 1) throw new FinanceFailure("forbidden");
        return {
          total: 2,
          totalCount: 2,
          isReconciled: true,
          snapshotId: "A".repeat(64),
          items: [{ id: "e", amount: 1 }],
        };
      },
    },
    "a",
    "2026-10",
    "BRL",
  );
  const stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().status, "ready");
  store.loadMore();
  await tick();
  assert.equal(store.getSnapshot().status, "error");
  assert.equal(store.getSnapshot().data, null);
  stop();
});

test("expense store handles an empty period and uses the expense endpoint", async () => {
  const { createIncomeDetailsStore } = await import("./index.mjs");
  let called = false;
  const store = createIncomeDetailsStore(
    {
      expense: async () => {
        called = true;
        return {
          total: 0,
          totalCount: 0,
          snapshotId: "A".repeat(64),
          isReconciled: true,
          items: [],
        };
      },
      income: async () => {
        throw new Error("wrong endpoint");
      },
    },
    "home",
    "2026-10",
    "BRL",
    { kind: "expense" },
  );
  const stop = store.start();
  await tick();
  assert.equal(called, true);
  assert.equal(store.getSnapshot().status, "ready");
  assert.equal(store.getSnapshot().data.totalCount, 0);
  assert.deepEqual(store.getSnapshot().data.items, []);
  stop();
});

test("result entries merge recent income and expense, preserve reversals, and filter", async () => {
  const { recentResultEntries } = await import("./index.mjs");
  const income = [
    { id: "i1", transactionId: "1", date: "2026-10-03", amount: 100 },
    {
      id: "i2",
      transactionId: "2",
      date: "2026-10-01",
      amount: -20,
      isReversal: true,
    },
  ];
  const expense = [
    { id: "e1", transactionId: "3", date: "2026-10-04", amount: 50 },
    {
      id: "e2",
      transactionId: "4",
      date: "2026-10-02",
      amount: -10,
      isReversal: true,
    },
  ];
  const all = recentResultEntries(income, expense);
  assert.deepEqual(
    all.map((row) => row.id),
    ["e1", "i1", "e2", "i2"],
  );
  assert.equal(all[2].isReversal, true);
  assert.deepEqual(
    recentResultEntries(income, expense, "income").map((row) => row.id),
    ["i1", "i2"],
  );
  assert.deepEqual(
    recentResultEntries(income, expense, "expense").map((row) => row.id),
    ["e1", "e2"],
  );
  assert.deepEqual(recentResultEntries([], []), []);
});

test("category summary aggregates parent and child without double counting and keeps uncategorized", async () => {
  const { buildCategorySummary } = await import("./index.mjs");
  const data = buildCategorySummary(
    [
      { id: "p", name: "Moradia", parentId: null },
      { id: "c", name: "Aluguel", parentId: "p" },
      { id: "x", name: "Mercado", parentId: null },
    ],
    [
      { id: "p", amount: 100 },
      { id: "c", amount: 250 },
      { id: "x", amount: -30 },
    ],
    350,
  );
  assert.equal(data.groups.find((x) => x.id === "p").amount, 350);
  assert.equal(data.groups.find((x) => x.id === "p").children[0].amount, 250);
  assert.equal(data.groups.find((x) => x.id === null).amount, 30);
  assert.equal(data.groups.find((x) => x.id === "x").amount, -30);
  assert.throws(() =>
    buildCategorySummary(
      [
        { id: "a", name: "A", parentId: "b" },
        { id: "b", name: "B", parentId: "a" },
      ],
      [],
      0,
    ),
  );
});

test("category summary reads the authenticated dashboard and archived category catalog", async () => {
  const calls = [];
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, options) => {
      calls.push({ url, token: options.headers.Authorization });
      if (url.includes("/categories?"))
        return json([
          { id: "p", name: "Moradia", parentId: null },
          { id: "c", name: "Aluguel", parentId: "p" },
        ]);
      return json({
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        isReconciled: true,
        summaries: [{ currency: "BRL", expenseCents: 500 }],
        categoryExpenses: [
          { categoryId: "c", currency: "BRL", amountCents: 500 },
        ],
      });
    },
  });
  const data = await repo.categorySummary("home", "2026-10", "BRL");
  assert.equal(data.groups[0].name, "Moradia");
  assert.equal(data.groups[0].amount, 500);
  assert.equal(data.groups[0].children[0].id, "c");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.token === "Bearer jwt"));
  assert.ok(
    calls.some((call) => call.url.endsWith("/categories?includeArchived=true")),
  );
});

test("income source totals cover the full period before pagination and preserve source ids", async () => {
  const raw = {
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    currency: "BRL",
    snapshotId: "A".repeat(64),
    totalCents: 100,
    totalCount: 3,
    offset: 0,
    isReconciled: true,
    sources: [
      {
        incomeSourceId: "a",
        incomeSourceName: "Salário",
        amountCents: 100,
        entryCount: 1,
      },
      {
        incomeSourceId: "b",
        incomeSourceName: "Salário",
        amountCents: 0,
        entryCount: 2,
      },
    ],
    items: [
      {
        entryId: "e",
        transactionId: "t",
        accountId: "bank",
        accountName: "Conta",
        occurredOn: "2026-10-03",
        incomeSourceId: "a",
        incomeSourceName: "Salário",
        amountCents: 100,
        isReversal: false,
      },
    ],
  };
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async () => json(raw),
  });
  const data = await repo.income("home", "2026-10", "BRL", 0);
  assert.equal(data.items.length, 1);
  assert.equal(data.totalCount, 3);
  assert.equal(data.sources.length, 2);
  assert.equal(data.sources[1].amount, 0);
  assert.equal(data.sources[1].count, 2);
  assert.equal(data.items[0].sourceId, "a");
  raw.sources[0].amountCents = 101;
  await assert.rejects(
    repo.income("home", "2026-10", "BRL", 0),
    (e) => e.code === "invalid",
  );
  raw.sources[0].amountCents = 100;
  raw.sources[1].entryCount = 1;
  await assert.rejects(
    repo.income("home", "2026-10", "BRL", 0),
    (e) => e.code === "invalid",
  );
});
