import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinanceRepository,
  createClassificationStore,
  canCorrectClassification,
  classificationChoices,
  FinanceFailure,
} from "./index.mjs";
const id = "d6b5efbd-1cda-4818-84c7-a682e1078592",
  key = "debd183b-1474-4e1f-84b1-cbf8c55b4102";
const detail = {
  id,
  kind: "income",
  status: "posted",
  categoryId: "child",
  sourceId: "source",
  rawDescription: "Salary",
  reversalOf: null,
};
const catalogs = {
  accounts: [],
  categories: [
    { id: "parent", name: "Income", flow: "income" },
    { id: "child", name: "Salary", flow: "income", parentId: "parent" },
    { id: "expense", name: "Food", flow: "expense" },
  ],
  sources: [{ id: "source", name: "Employer" }],
};
const tick = () => new Promise((r) => setTimeout(r, 0));
function storage() {
  let value = null;
  return {
    load: async () => value,
    save: async (v) => {
      value = v;
    },
    remove: async () => {
      value = null;
    },
    peek: () => value,
  };
}
test("classification PATCH sends only mutable metadata, authenticated with a stable operation key", async () => {
  let request;
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          transactionId: id,
          categoryId: "child",
          incomeSourceId: null,
          description: "Updated",
        }),
      );
    },
  });
  await repo.correctClassification(
    "h",
    id,
    { categoryId: "child", incomeSourceId: null, description: "Updated" },
    key,
  );
  assert.equal(
    request.url,
    `https://api.example/api/v1/households/h/ledger/transactions/${id}`,
  );
  assert.equal(request.init.method, "PATCH");
  assert.equal(request.init.headers.Authorization, "Bearer jwt");
  assert.equal(request.init.headers["Idempotency-Key"], key);
  assert.deepEqual(JSON.parse(request.init.body), {
    categoryId: "child",
    incomeSourceId: null,
    description: "Updated",
  });
});
test("classification loads actual fields without writing and restores an uncertain correction for exact replay", async () => {
  const saved = storage(),
    calls = [];
  let fail = true;
  const repository = {
    transaction: async () => detail,
    recordOptions: async () => catalogs,
    correctClassification: async (...args) => {
      assert.ok(saved.peek());
      calls.push(args.slice(0, 4));
      if (fail) throw new FinanceFailure("network");
      return { transactionId: id, replayed: true };
    },
  };
  let store = createClassificationStore(repository, "h", id, {
      storage: saved,
      randomId: () => key,
    }),
    stop = store.start();
  await tick();
  assert.deepEqual(store.getSnapshot().fields, {
    categoryId: "child",
    sourceId: "source",
    description: "Salary",
  });
  assert.equal(calls.length, 0);
  store.edit("sourceId", "");
  store.edit("description", " Updated ");
  assert.equal(saved.peek(), null);
  await Promise.all([store.submit(), store.submit()]);
  assert.equal(calls.length, 1);
  assert.equal(store.getSnapshot().status, "uncertain");
  stop();
  store = createClassificationStore(repository, "h", id, {
    storage: saved,
    randomId: () => key,
  });
  stop = store.start();
  await tick();
  store.edit("description", "Must not overwrite pending body");
  fail = false;
  await store.submit();
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[0][2], {
    categoryId: "child",
    incomeSourceId: null,
    description: "Updated",
  });
  assert.equal(store.getSnapshot().status, "success");
  stop();
});
test("correction validates flow, optional source and transaction state before any write", async () => {
  for (const [current, fields] of [
    [{ ...detail, status: "reversed" }, {}],
    [{ ...detail, kind: "transfer" }, {}],
    [{ ...detail, kind: "openingbalance" }, {}],
    [detail, { categoryId: "expense" }],
    [detail, { sourceId: "foreign" }],
    [
      { ...detail, kind: "expense", categoryId: "expense" },
      { sourceId: "source" },
    ],
  ]) {
    let writes = 0;
    const store = createClassificationStore(
      {
        transaction: async () => current,
        recordOptions: async () => catalogs,
        correctClassification: async () => {
          writes++;
        },
      },
      "h",
      id,
      { storage: storage(), randomId: () => key },
    );
    const stop = store.start();
    await tick();
    for (const [f, v] of Object.entries(fields)) store.edit(f, v);
    await store.submit();
    assert.equal(writes, 0);
    stop();
  }
  assert.equal(
    canCorrectClassification({ ...detail, kind: "reversal" }),
    false,
  );
});
test("category choices preserve child IDs and report unavailable existing classifications without replacing them", () => {
  const choices = classificationChoices({ ...catalogs, detail });
  assert.deepEqual(
    choices.categories.map((c) => c.id),
    ["parent", "child"],
  );
  assert.equal(choices.categories[1].name, "Income › Salary");
  assert.equal(choices.sources[0].id, "");
  const archived = classificationChoices({
    ...catalogs,
    detail: { ...detail, categoryId: "archived", sourceId: "removed" },
  });
  assert.equal(archived.categories.at(-1).disabled, true);
  assert.equal(archived.sources.at(-1).disabled, true);
});
