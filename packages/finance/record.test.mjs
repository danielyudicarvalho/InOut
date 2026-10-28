import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinanceRepository,
  createRecordStore,
  FinanceFailure,
  prepareRecord,
  recordAmount,
} from "./index.mjs";
const key = "a4b553bf-5fbc-4b82-b588-e009f13512dd";
const options = {
  accounts: [
    { id: "bank", name: "Banco", currency: "BRL" },
    { id: "cash", name: "Carteira", currency: "BRL" },
    { id: "usd", name: "Dólar", currency: "USD" },
  ],
  categories: [
    { id: "salary", name: "Trabalho", flow: "income" },
    { id: "food", name: "Alimentação", flow: "expense" },
  ],
  sources: [{ id: "work", name: "Salário" }],
};
const fields = {
  accountId: "bank",
  destinationId: "cash",
  categoryId: "salary",
  sourceId: "work",
  amount: "1250,50",
  date: "2026-10-28",
  description: "  Salário  ",
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function storage(initial = null) {
  let saved = initial;
  return {
    load: async () => saved,
    save: async (value) => {
      saved = value;
    },
    remove: async (expected) => {
      if (saved && JSON.parse(saved).key === expected) saved = null;
    },
    peek: () => saved,
  };
}
function mockRepository(post) {
  return { recordOptions: async () => options, postRecord: post };
}
function ready(store) {
  const stop = store.start();
  return tick().then(() => stop);
}
function fill(store) {
  for (const [field, value] of Object.entries(fields)) store.edit(field, value);
}
test("record amounts retain exact cents and reject ambiguous or invalid input", () => {
  assert.equal(recordAmount("1250,50"), 125050);
  assert.equal(recordAmount("0.01"), 1);
  assert.equal(recordAmount("90071992547409,91"), Number.MAX_SAFE_INTEGER);
  for (const amount of [
    "0",
    "-1",
    "1.000",
    "1,234",
    "1.250,00",
    "1e3",
    "R$ 10",
    "90071992547409,92",
    "",
  ])
    assert.throws(() => recordAmount(amount));
});
test("record preparation enforces flow, source and same-currency transfer rules", () => {
  const income = prepareRecord("income", fields, options);
  assert.equal(income.amountCents, 125050);
  assert.equal(income.incomeSourceId, "work");
  assert.equal(income.description, "Salário");
  const transfer = prepareRecord("transfer", fields, options);
  assert.equal(transfer.sourceAccountId, "bank");
  assert.equal(transfer.destinationAccountId, "cash");
  assert.equal("categoryId" in transfer, false);
  for (const invalid of [{ destinationId: "bank" }, { destinationId: "usd" }])
    assert.throws(() =>
      prepareRecord("transfer", { ...fields, ...invalid }, options),
    );
  assert.throws(() => prepareRecord("expense", fields, options));
  assert.throws(() =>
    prepareRecord("income", { ...fields, sourceId: "other" }, options),
  );
  assert.throws(() =>
    prepareRecord("income", { ...fields, date: "2026-02-30" }, options),
  );
});
test("record options check membership before household queries and writes use exact API contracts", async () => {
  const calls = [];
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (init.method === "POST")
        return new Response(
          JSON.stringify({ transactionId: "tx", replayed: true }),
          { status: 200 },
        );
      return new Response(JSON.stringify([]), { status: 200 });
    },
  });
  await assert.rejects(
    repo.recordOptions("denied"),
    (error) => error.code === "forbidden",
  );
  assert.equal(calls.length, 1);
  const result = await repo.postRecord(
    "home",
    "income",
    prepareRecord("income", fields, options),
    key,
  );
  assert.equal(result.replayed, true);
  const request = calls.at(-1);
  assert.equal(
    request.url,
    "https://api.example/api/v1/households/home/ledger/income",
  );
  assert.equal(request.init.headers["Idempotency-Key"], key);
  assert.equal(request.init.headers.Authorization, "Bearer jwt");
  assert.equal(JSON.parse(request.init.body).amountCents, 125050);
});
test("record store never submits on load, persists first and retries uncertain results with the same body and key", async () => {
  const saved = storage();
  const calls = [];
  let attempt = 0;
  const store = createRecordStore(
    mockRepository(async (household, kind, body, operationKey) => {
      assert.ok(saved.peek());
      calls.push({ household, kind, body, operationKey });
      if (attempt++ === 0) throw new FinanceFailure("network");
      return { transactionId: "tx", replayed: true };
    }),
    "home",
    "income",
    "BRL",
    { storage: saved, randomId: () => key },
  );
  const stop = await ready(store);
  assert.equal(calls.length, 0);
  fill(store);
  await store.submit();
  assert.equal(store.getSnapshot().status, "uncertain");
  store.edit("amount", "999");
  assert.equal(store.getSnapshot().fields.amount, fields.amount);
  await store.submit();
  assert.equal(store.getSnapshot().status, "success");
  assert.deepEqual(calls[0], calls[1]);
  await tick();
  assert.equal(saved.peek(), null);
  stop();
});
test("a pending record restores its original kind and key after reopening the form", async () => {
  const saved = storage();
  let calls = 0;
  const repo = mockRepository(async () => {
    calls++;
    throw new FinanceFailure("network");
  });
  const first = createRecordStore(repo, "home", "income", "BRL", {
    storage: saved,
    randomId: () => key,
  });
  const stop = await ready(first);
  fill(first);
  await first.submit();
  stop();
  let restoredKey;
  const next = createRecordStore(
    mockRepository(async (household, kind, body, k) => {
      assert.equal(kind, "income");
      assert.equal(body.amountCents, 125050);
      restoredKey = k;
      return { transactionId: "tx", replayed: true };
    }),
    "home",
    "transfer",
    "BRL",
    {
      storage: saved,
      randomId: () => {
        throw Error("must reuse");
      },
    },
  );
  const cleanup = await ready(next);
  assert.equal(next.getSnapshot().kind, "income");
  assert.equal(next.getSnapshot().status, "uncertain");
  await next.submit();
  assert.equal(restoredKey, key);
  assert.equal(calls, 1);
  cleanup();
});
test("failed durable storage and invalid fields prevent any write", async () => {
  let writes = 0;
  const store = createRecordStore(
    mockRepository(async () => {
      writes++;
    }),
    "home",
    "income",
    "BRL",
    {
      storage: {
        load: async () => null,
        save: async () => {
          throw Error("unavailable");
        },
        remove: async () => {},
      },
      randomId: () => key,
    },
  );
  const stop = await ready(store);
  await store.submit();
  assert.equal(writes, 0);
  fill(store);
  await store.submit();
  assert.equal(writes, 0);
  assert.equal(store.getSnapshot().status, "ready");
  stop();
});
test("double submit is suppressed and a late response after timeout cannot clear a pending record", async () => {
  let resolve;
  let writes = 0;
  const saved = storage();
  const store = createRecordStore(
    mockRepository(() => {
      writes++;
      return new Promise((done) => {
        resolve = done;
      });
    }),
    "home",
    "income",
    "BRL",
    { storage: saved, randomId: () => key, timeoutMs: 20 },
  );
  const stop = await ready(store);
  fill(store);
  const pending = store.submit();
  await tick();
  void store.submit();
  assert.equal(writes, 1);
  await new Promise((done) => setTimeout(done, 30));
  assert.equal(store.getSnapshot().status, "uncertain");
  resolve({ transactionId: "tx", replayed: false });
  await pending;
  assert.equal(store.getSnapshot().status, "uncertain");
  assert.ok(saved.peek());
  stop();
});
test("forbidden writes clear visible options and retain their pending key", async () => {
  const saved = storage();
  const store = createRecordStore(
    mockRepository(async () => {
      throw new FinanceFailure("forbidden");
    }),
    "home",
    "income",
    "BRL",
    { storage: saved, randomId: () => key },
  );
  const stop = await ready(store);
  fill(store);
  await store.submit();
  assert.equal(store.getSnapshot().status, "error");
  assert.equal(store.getSnapshot().options, null);
  assert.ok(saved.peek());
  stop();
});

test("active catalogs are loaded only after membership and archived choices are excluded", async () => {
  const calls = [];
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url) => {
      calls.push(url);
      let data;
      if (url.endsWith("/api/v1/households"))
        data = [{ id: "home", name: "Casa" }];
      else if (url.endsWith("/accounts"))
        data = [
          { id: "bank", name: "Banco", currency: "BRL", archivedAt: null },
          {
            id: "old",
            name: "Antiga",
            currency: "BRL",
            archivedAt: "2026-01-01",
          },
        ];
      else if (url.endsWith("/categories"))
        data = [
          { id: "cat", name: "Trabalho", flow: "Income", archivedAt: null },
        ];
      else data = [{ id: "work", name: "Salário", archivedAt: null }];
      return new Response(JSON.stringify(data), { status: 200 });
    },
  });
  const data = await repo.recordOptions("home");
  assert.equal(calls.length, 4);
  assert.equal(data.accounts.length, 1);
  assert.equal(data.categories[0].flow, "income");
});
test("definitive validation errors allow correction, while an expired pending record is not resubmitted", async () => {
  const saved = storage();
  const store = createRecordStore(
    mockRepository(async () => {
      throw new FinanceFailure("validation");
    }),
    "home",
    "income",
    "BRL",
    { storage: saved, randomId: () => key },
  );
  const stop = await ready(store);
  fill(store);
  await store.submit();
  assert.equal(store.getSnapshot().status, "ready");
  assert.equal(saved.peek(), null);
  store.edit("amount", "10");
  assert.equal(store.getSnapshot().fields.amount, "10");
  stop();
  const expired = storage(
    JSON.stringify({
      version: 1,
      householdId: "home",
      kind: "income",
      key,
      createdAt: 0,
      body: prepareRecord("income", fields, options),
    }),
  );
  let writes = 0;
  const old = createRecordStore(
    mockRepository(async () => {
      writes++;
    }),
    "home",
    "income",
    "BRL",
    { storage: expired, randomId: () => key },
  );
  const cleanup = await ready(old);
  assert.equal(old.getSnapshot().status, "error");
  await old.submit();
  assert.equal(writes, 0);
  cleanup();
});
