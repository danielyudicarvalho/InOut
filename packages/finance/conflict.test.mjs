import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinanceRepository,
  createClassificationStore,
  createTransactionDetailStore,
  canCorrectClassification,
  FinanceFailure,
} from "./index.mjs";
const id = "d6b5efbd-1cda-4818-84c7-a682e1078592",
  key = "debd183b-1474-4e1f-84b1-cbf8c55b4102",
  reversal = "b624afdc-08dc-46da-95b3-25cb5c3aa08b";
const detail = {
  id,
  kind: "expense",
  status: "posted",
  categoryId: "food",
  sourceId: null,
  rawDescription: "Compras da semana",
  reversalOf: null,
};
const catalogs = {
  accounts: [],
  categories: [{ id: "food", name: "Alimentação", flow: "expense" }],
  sources: [],
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
function fixture(code, malformed = false) {
  return createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async () =>
      new Response(malformed ? "not json" : JSON.stringify({ code }), {
        status: 409,
      }),
  });
}
test("only the explicit transaction_changed problem code establishes a definite rejection", async () => {
  await assert.rejects(
    fixture("transaction_changed").correctClassification("h", id, {}, key),
    (e) => e.code === "stale",
  );
  for (const [code, malformed] of [
    ["idempotency_conflict", false],
    ["idempotency_in_progress", false],
    ["account_archived", false],
    ["unrecognized", false],
    ["transaction_changed", true],
  ]) {
    await assert.rejects(
      fixture(code, malformed).correctClassification("h", id, {}, key),
      (e) => e.code === "conflict",
    );
  }
});
test("a stale edit cannot be resubmitted; reload clears the rejected key and reads current metadata", async () => {
  const saved = storage();
  let writes = 0,
    current = detail;
  const store = createClassificationStore(
    {
      transaction: async () => current,
      recordOptions: async () => catalogs,
      correctClassification: async (h, t, body) => {
        writes++;
        assert.deepEqual(body.expectedState, {
          status: "posted",
          categoryId: "food",
          incomeSourceId: null,
          description: "Compras da semana",
        });
        current = { ...detail, status: "reversed" };
        throw new FinanceFailure("stale");
      },
    },
    "h",
    id,
    { storage: saved, randomId: () => key },
  );
  const stop = store.start();
  await tick();
  store.edit("description", "Minha correção");
  await store.submit();
  assert.equal(store.getSnapshot().status, "stale");
  assert.equal(saved.peek(), null);
  await store.submit();
  store.edit("description", "Outra alteração");
  assert.equal(writes, 1);
  store.retry();
  await tick();
  assert.equal(writes, 1);
  assert.equal(store.getSnapshot().options.detail.status, "reversed");
  assert.equal(
    canCorrectClassification(store.getSnapshot().options.detail),
    false,
  );
  stop();
});
test("uncertain 409 responses retain the exact original precondition, body and key even after another read", async () => {
  const saved = storage(),
    calls = [];
  let current = detail;
  const repository = {
    transaction: async () => current,
    recordOptions: async () => catalogs,
    correctClassification: async (...args) => {
      calls.push(args.slice(0, 4));
      throw new FinanceFailure("conflict");
    },
  };
  let store = createClassificationStore(repository, "h", id, {
      storage: saved,
      randomId: () => key,
    }),
    stop = store.start();
  await tick();
  store.edit("description", "Updated");
  await store.submit();
  stop();
  assert.equal(store.getSnapshot().status, "uncertain");
  assert.ok(saved.peek());
  current = { ...detail, rawDescription: "Alteração de outra pessoa" };
  store = createClassificationStore(repository, "h", id, {
    storage: saved,
    randomId: () => {
      throw Error("must reuse key");
    },
  });
  stop = store.start();
  await tick();
  await store.submit();
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[1][2].expectedState.description, detail.rawDescription);
  stop();
});
test("a persisted rejection whose cleanup failed is removed before a fresh edit; failed cleanup blocks writes", async () => {
  const saved = storage();
  let failCleanup = true,
    writes = 0;
  const durable = {
    ...saved,
    remove: async () => {
      if (failCleanup) throw Error("disk");
      await saved.remove();
    },
  };
  const repo = {
    transaction: async () => detail,
    recordOptions: async () => catalogs,
    correctClassification: async () => {
      writes++;
      throw new FinanceFailure("stale");
    },
  };
  let store = createClassificationStore(repo, "h", id, {
      storage: durable,
      randomId: () => key,
    }),
    stop = store.start();
  await tick();
  await store.submit();
  assert.equal(store.getSnapshot().status, "stale");
  assert.equal(JSON.parse(saved.peek()).rejected, true);
  stop();
  store = createClassificationStore(repo, "h", id, {
    storage: durable,
    randomId: () => key,
  });
  stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().status, "error");
  await store.submit();
  assert.equal(writes, 1);
  failCleanup = false;
  store.retry();
  await tick();
  assert.equal(saved.peek(), null);
  assert.equal(store.getSnapshot().status, "ready");
  assert.equal(writes, 1);
  stop();
});
const raw = {
  transactionId: id,
  kind: "expense",
  status: "posted",
  description: "Compras da semana",
  reversalOf: null,
  occurredOn: "2026-11-02",
  postedAt: "2026-11-02T12:00:00Z",
  createdBy: "actor",
  accountId: "bank",
  accountName: "Conta principal",
  categoryId: "food",
  categoryName: "Alimentação",
  direction: "debit",
  amountCents: 32000,
  currency: "BRL",
  incomeSourceId: null,
};
test("reloading uses authenticated exact-id reads and exposes the actual reversal link and available actions", async () => {
  let reversed = false;
  const calls = [];
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, init) => {
      calls.push([String(url), init]);
      assert.equal(init.headers.Authorization, "Bearer jwt");
      assert.equal(init.cache, "no-store");
      assert.equal(init.method, undefined);
      let body;
      if (String(url).endsWith("/api/v1/households"))
        body = [{ id: "h", name: "Lar" }];
      else if (String(url).includes("/categories")) body = [];
      else if (String(url).includes("reversalOf="))
        body = [
          { ...raw, transactionId: reversal, kind: "reversal", reversalOf: id },
        ];
      else {
        assert.ok(String(url).includes(`transactionId=${id}`));
        assert.equal(String(url).includes("from="), false);
        body = [{ ...raw, status: reversed ? "reversed" : "posted" }];
      }
      return Response.json(body);
    },
  });
  const store = createTransactionDetailStore(repo, "h", id),
    stop = store.start();
  await tick();
  assert.equal(canCorrectClassification(store.getSnapshot().detail), true);
  assert.equal(store.getSnapshot().refreshed, false);
  reversed = true;
  await store.reload();
  assert.equal(store.getSnapshot().refreshed, true);
  assert.equal(store.getSnapshot().detail.amount, -32000);
  assert.equal(store.getSnapshot().detail.reversalId, reversal);
  assert.equal(canCorrectClassification(store.getSnapshot().detail), false);
  assert.equal(
    calls.some(([url]) => url.includes("reversalOf=")),
    true,
  );
  stop();
});
test("failed reload removes old actionable data and a late response cannot restore it", async () => {
  let request = 0,
    resolveOld;
  const store = createTransactionDetailStore(
    {
      transaction: async () => {
        request++;
        if (request === 1) return detail;
        if (request === 2) return new Promise((r) => (resolveOld = r));
        throw new FinanceFailure("forbidden");
      },
    },
    "h",
    id,
  );
  const stop = store.start();
  await tick();
  const first = store.reload();
  assert.equal(store.getSnapshot().detail, null);
  await store.reload();
  resolveOld(detail);
  await first;
  assert.equal(store.getSnapshot().status, "error");
  assert.equal(store.getSnapshot().detail, null);
  assert.equal(store.getSnapshot().refreshed, false);
  stop();
});
test("detail reads fail closed for an unauthorized household, wrong transaction or mismatched reversal", async () => {
  for (const scenario of ["forbidden", "wrong", "reversal"]) {
    let financialReads = 0;
    const repo = createFinanceRepository({
      baseUrl: "https://api.example",
      getToken: async () => "jwt",
      fetcher: async (url) => {
        if (String(url).endsWith("/api/v1/households"))
          return Response.json(
            scenario === "forbidden" ? [] : [{ id: "h", name: "Lar" }],
          );
        financialReads++;
        if (String(url).includes("categories")) return Response.json([]);
        if (scenario === "wrong")
          return Response.json([{ ...raw, transactionId: reversal }]);
        if (String(url).includes("reversalOf="))
          return Response.json([
            {
              ...raw,
              transactionId: reversal,
              reversalOf: "foreign",
              kind: "reversal",
            },
          ]);
        return Response.json([{ ...raw, status: "reversed" }]);
      },
    });
    await assert.rejects(
      repo.transaction("h", id),
      (e) => e.code === (scenario === "forbidden" ? "forbidden" : "invalid"),
    );
    if (scenario === "forbidden") assert.equal(financialReads, 0);
  }
});

test("detail timeout and unmount ignore late reads and never announce an update", async () => {
  let resolve;
  const store = createTransactionDetailStore(
    {
      transaction: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
    "h",
    id,
    { timeoutMs: 5 },
  );
  const stop = store.start();
  await new Promise((r) => setTimeout(r, 12));
  resolve(detail);
  await tick();
  assert.equal(store.getSnapshot().status, "error");
  assert.equal(store.getSnapshot().refreshed, false);
  assert.equal(store.getSnapshot().detail, null);
  stop();
});
test("existing inline creation calls use the real entity ids and authenticated category/source contracts", async () => {
  const calls = [];
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, init, body });
      return Response.json(body);
    },
  });
  const category = await repo.createCategory(
    "h",
    { name: "Mercado", flow: "expense", parentId: "food" },
    key,
  );
  const source = await repo.createIncomeSource("h", { name: "Employer" }, id);
  assert.equal(category.parentId, "food");
  assert.equal(source.id, id);
  assert.deepEqual(calls[0].body, {
    id: key,
    name: "Mercado",
    flow: "expense",
    parentId: "food",
  });
  assert.ok(calls[0].url.endsWith("/categories"));
  assert.ok(calls[1].url.endsWith("/income-sources"));
  for (const call of calls) {
    assert.equal(call.init.headers.Authorization, "Bearer jwt");
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.headers["Idempotency-Key"], call.body.id);
  }
});
