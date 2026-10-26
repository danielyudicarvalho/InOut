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
  accounts: [{ accountId: "account", accountName: "Conta", currency: "EUR" }],
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
  assert.equal(calls.length, 8);
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
