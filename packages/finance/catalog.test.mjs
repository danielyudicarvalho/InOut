import test from "node:test";
import assert from "node:assert/strict";
import {
  createCatalogRepository,
  createCatalogStore,
  categoryParentChoices,
  canArchiveCategory,
} from "./catalog.mjs";
import { FinanceFailure } from "./index.mjs";
const root = {
  id: "r",
  name: "Casa",
  flow: "expense",
  parentId: null,
  archivedAt: null,
};
const child = { ...root, id: "c", name: "Luz", parentId: "r" };
test("only active roots of the same flow may be parents; active children block archive", () => {
  const rows = [
    root,
    child,
    { ...root, id: "i", flow: "income" },
    { ...root, id: "a", archivedAt: "2026-10-01" },
  ];
  assert.deepEqual(categoryParentChoices(rows, "expense"), [root]);
  assert.equal(canArchiveCategory(rows, "r"), false);
  assert.equal(
    canArchiveCategory([{ ...child, archivedAt: "2026-10-01" }], "r"),
    true,
  );
});
test("catalog authenticates, includes archives, normalizes flow and DELETE preserves resources", async () => {
  const calls = [];
  const repo = createCatalogRepository({
    baseUrl: "https://api.example",
    getToken: async () => "token",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return init.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json(
            url.endsWith("/households")
              ? [{ id: "h", name: "Lar" }]
              : url.includes("/categories")
                ? [{ ...root, flow: "Expense" }]
                : [
                    {
                      id: "s",
                      name: "Salário",
                      currency: "USD",
                      archivedAt: "2026-10-01",
                    },
                  ],
          );
    },
  });
  const data = await repo.list("h");
  assert.equal(data.categories[0].flow, "expense");
  assert.ok(data.sources[0].archivedAt);
  assert.deepEqual(data.currencies, ["USD"]);
  await repo.archive("h", "sources", "s");
  assert.equal(calls.at(-1).init.method, "DELETE");
  assert.equal(calls.at(-1).init.headers.Authorization, "Bearer token");
  assert.ok(
    calls.some((c) => c.url.endsWith("categories?includeArchived=true")),
  );
  await assert.rejects(repo.list("other"), (e) => e.code === "forbidden");
});
function harness({
  pending = null,
  createError = false,
  rows = { categories: [root, child], sources: [] },
} = {}) {
  let value = pending ? JSON.stringify(pending) : null;
  const creates = [],
    archives = [];
  const repository = {
    list: async () => structuredClone(rows),
    create: async (h, p) => {
      creates.push(p);
      if (createError) throw new FinanceFailure("network");
      rows[p.type].push({ id: p.key, ...p.body, archivedAt: null });
      return { id: p.key, name: p.body.name };
    },
    archive: async (h, t, id) => {
      archives.push(id);
    },
  };
  const store = createCatalogStore(repository, "h", {
    randomId: () => "stable-key",
    storage: {
      load: async () => value,
      save: async (v) => {
        value = v;
      },
      remove: async (key) => {
        if (JSON.parse(value).key === key) value = null;
      },
    },
  });
  const stop = store.start();
  return {
    store,
    stop,
    creates,
    archives,
    get saved() {
      return value;
    },
    rows,
  };
}
async function settled(store) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setImmediate(r));
    if (!store.getSnapshot().loading) return;
  }
  throw Error("not settled");
}
test("rejects grandchildren and incompatible flows without writes; blocks parent archival", async () => {
  const h = harness();
  await settled(h.store);
  assert.equal(
    await h.store.create("categories", {
      name: "Teste",
      flow: "expense",
      parentId: "c",
    }),
    false,
  );
  assert.equal(
    await h.store.create("categories", {
      name: "Teste",
      flow: "income",
      parentId: "r",
    }),
    false,
  );
  assert.equal(
    await h.store.create("categories", { name: "   ", flow: "expense" }),
    false,
  );
  await h.store.archive("categories", "r");
  assert.equal(h.archives.length, 0);
  assert.equal(h.creates.length, 0);
  h.stop();
});
test("persists stable creation identity before sending and reconciles an uncertain result after restart", async () => {
  const h = harness({ createError: true });
  await settled(h.store);
  assert.equal(await h.store.create("sources", { name: "  Salário  " }), false);
  const pending = JSON.parse(h.saved);
  assert.equal(pending.key, "stable-key");
  assert.equal(pending.body.name, "Salário");
  assert.equal(await h.store.create("sources", { name: "Outra" }), false);
  h.stop();
  const recovered = harness({
    pending,
    rows: {
      categories: [],
      sources: [{ id: pending.key, name: pending.body.name, archivedAt: null }],
    },
  });
  await settled(recovered.store);
  assert.equal(recovered.saved, null);
  assert.equal(recovered.store.getSnapshot().pending, null);
  assert.equal(recovered.creates.length, 0);
  recovered.stop();
});
test("successful create refreshes lists and never creates while loading or already busy", async () => {
  const h = harness();
  assert.equal(await h.store.create("sources", { name: "Early" }), false);
  await settled(h.store);
  const first = h.store.create("sources", { name: "Salário" });
  assert.equal(await h.store.create("sources", { name: "Duplicate" }), false);
  assert.equal(await first, true);
  assert.equal(h.creates.length, 1);
  assert.equal(h.store.getSnapshot().sources.length, 1);
  assert.equal(h.saved, null);
  h.stop();
});
test("definitive category name conflict clears the pending identity so the name can be corrected", async () => {
  let stored = null;
  const repo = {
    list: async () => ({ categories: [], sources: [] }),
    create: async () => {
      throw new FinanceFailure("catalog_conflict");
    },
    archive: async () => {},
  };
  const store = createCatalogStore(repo, "h", {
    randomId: () => "key",
    storage: {
      load: async () => stored,
      save: async (v) => {
        stored = v;
      },
      remove: async () => {
        stored = null;
      },
    },
  });
  const stop = store.start();
  await settled(store);
  assert.equal(
    await store.create("categories", { name: "Existente", flow: "expense" }),
    false,
  );
  assert.equal(stored, null);
  assert.equal(store.getSnapshot().pending, null);
  stop();
});
test("recovery replays the same body and identifier, including source creation", async () => {
  const pending = {
    type: "sources",
    key: "same-id",
    body: { name: "Salário" },
  };
  const h = harness({ pending });
  await settled(h.store);
  assert.equal(await h.store.recover(), true);
  assert.deepEqual(h.creates, [pending]);
  assert.equal(h.saved, null);
  h.stop();
});
test("creation reuses existing quick-create backend contracts with stable IDs and matching flow/parent", async () => {
  const calls = [],
    key = "11111111-1111-4111-8111-111111111111";
  const repository = createCatalogRepository({
    baseUrl: "https://api.example",
    getToken: async () => "token",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      const body = JSON.parse(init.body);
      return Response.json({ ...body, flow: "Expense" }, { status: 201 });
    },
  });
  await repository.create("h", {
    key,
    type: "categories",
    body: { name: "Mercado", flow: "expense", parentId: "root" },
  });
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    id: key,
    name: "Mercado",
    flow: "expense",
    parentId: "root",
  });
  assert.equal(calls[0].init.headers["Idempotency-Key"], key);
  await repository.create("h", {
    key,
    type: "sources",
    body: { name: "Salário" },
  });
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    id: key,
    name: "Salário",
  });
  assert.ok(calls[1].url.endsWith("/income-sources"));
});
test("known duplicate-name domain responses allow correction; generic conflicts remain uncertain", async () => {
  for (const [code, expected] of [
    ["category_conflict", "catalog_conflict"],
    ["income_source_conflict", "catalog_conflict"],
    ["unknown", "conflict"],
  ]) {
    const repo = createCatalogRepository({
      baseUrl: "https://api.example",
      getToken: async () => "token",
      fetcher: async () => Response.json({ code }, { status: 409 }),
    });
    await assert.rejects(
      repo.create("h", {
        key: "11111111-1111-4111-8111-111111111111",
        type: "categories",
        body: { name: "X", flow: "expense" },
      }),
      (e) => e.code === expected,
    );
  }
});
test("failed initial read never pretends that the catalog is empty or allows creation", async () => {
  let writes = 0;
  const store = createCatalogStore(
    {
      list: async () => {
        throw new FinanceFailure("network");
      },
      create: async () => {
        writes++;
      },
      archive: async () => {},
    },
    "h",
    {
      randomId: () => "id",
      storage: {
        load: async () => null,
        save: async () => {},
        remove: async () => {},
      },
    },
  );
  const stop = store.start();
  await settled(store);
  assert.ok(store.getSnapshot().error);
  assert.equal(await store.create("sources", { name: "Salário" }), false);
  assert.equal(writes, 0);
  stop();
});
test("historical source share opts in to archived accounts without changing existing dashboard queries", async () => {
  const { createFinanceRepository } = await import("./index.mjs");
  const calls = [];
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "token",
    fetcher: async (url) => {
      calls.push(url);
      return Response.json({
        currency: "USD",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        totalCents: 0,
        isReconciled: true,
        totalCount: 0,
        offset: 0,
        snapshotId: "A".repeat(64),
        items: [],
        sources: [],
      });
    },
  });
  await repo.income("h", "2026-10", "USD", 0, undefined, true);
  await repo.income("h", "2026-10", "USD", 0);
  assert.equal(
    new URL(calls[0]).searchParams.get("includeArchivedAccounts"),
    "true",
  );
  assert.equal(
    new URL(calls[1]).searchParams.has("includeArchivedAccounts"),
    false,
  );
});
