import test from "node:test";
import assert from "node:assert/strict";
import {
  selectorSearch,
  calendarMonth,
  calendarDays,
  createAuxiliaryStore,
  createFinanceRepository,
  createRecordStore,
  FinanceFailure,
} from "./index.mjs";
const id = "bc3e3f81-201d-425d-98c3-a480f7432894",
  key = "cfe289a0-e0af-433a-9f21-dc5a45c92f40",
  parent = "55c04529-dd83-44aa-a105-f12613afef42";
const catalog = {
  accounts: [
    { id: "a", name: "Conta A", currency: "BRL" },
    { id: "b", name: "Conta B", currency: "BRL" },
  ],
  categories: [{ id: parent, name: "Casa", flow: "expense" }],
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
async function start(store) {
  const stop = store.start();
  await tick();
  return stop;
}
test("selector search matches accents and detail without changing selected identifiers or source order", () => {
  const items = [
    { id: "1", name: "Alimentação", detail: "Mercado" },
    { id: "2", name: "Conta", detail: "Dólar · USD" },
  ];
  assert.deepEqual(selectorSearch(items, "alimentacao"), [items[0]]);
  assert.deepEqual(selectorSearch(items, "usd"), [items[1]]);
  assert.deepEqual(selectorSearch(items, "  "), items);
  assert.deepEqual(selectorSearch(items, "nada"), []);
});
test("calendar navigation crosses years, aligns Monday and validates boundary months", () => {
  assert.equal(calendarMonth("2026-12", 1), "2027-01");
  assert.equal(calendarMonth("2026-01", -1), "2025-12");
  assert.equal(calendarDays("2028-02").filter(Boolean).length, 29);
  assert.throws(() => calendarMonth("2000-01", -1), { code: "period" });
});
test("auxiliary creation persists first, restores same entity id and key, and does not submit on selection or load", async () => {
  const saved = storage(),
    calls = [];
  let fail = true,
    n = 0;
  const repo = {
    recordOptions: async () => catalog,
    createAuxiliary: async (...args) => {
      assert.ok(saved.peek());
      calls.push(args.slice(0, 4));
      if (fail) throw new FinanceFailure("network");
      return { id };
    },
  };
  const opts = { storage: saved, randomId: () => (n++ === 0 ? id : key) };
  const store = createAuxiliaryStore(
    repo,
    "home",
    "category",
    "expense",
    parent,
    "BRL",
    opts,
  );
  let stop = await start(store);
  assert.equal(calls.length, 0);
  store.edit("name", " Mercado ");
  await store.submit();
  assert.equal(store.getSnapshot().status, "uncertain");
  stop();
  const reopened = createAuxiliaryStore(
    repo,
    "home",
    "category",
    "expense",
    parent,
    "BRL",
    opts,
  );
  stop = await start(reopened);
  assert.equal(reopened.getSnapshot().fields.name, "Mercado");
  assert.equal(calls.length, 1);
  fail = false;
  await reopened.submit();
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(reopened.getSnapshot().status, "success");
  stop();
});
test("creation rejects incompatible parent before writing and account creation starts at zero balance", async () => {
  const bodies = [],
    repo = {
      recordOptions: async () => catalog,
      createAuxiliary: async (h, k, b) => {
        bodies.push(b);
        return { id: b.id };
      },
    };
  let store = createAuxiliaryStore(
      repo,
      "home",
      "category",
      "income",
      parent,
      "BRL",
      { storage: storage(), randomId: () => id },
    ),
    stop = await start(store);
  store.edit("name", "Inválida");
  await store.submit();
  assert.equal(bodies.length, 0);
  stop();
  store = createAuxiliaryStore(repo, "home", "account", "expense", "", "BRL", {
    storage: storage(),
    randomId: () => id,
  });
  stop = await start(store);
  store.edit("name", "Reserva");
  await store.submit();
  assert.equal(bodies[0].initialBalanceCents, 0);
  assert.equal(bodies[0].currency, "BRL");
  stop();
});
test("source retry resolves the same backend identifier after an uncertain response without a duplicate POST", async () => {
  let existing = null,
    posts = 0;
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, init) => {
      if (init.method === "POST") {
        posts++;
        existing = { id, name: "Empresa", archivedAt: null };
        throw new Error("connection lost");
      }
      return new Response(JSON.stringify(existing ? [existing] : []));
    },
  });
  await assert.rejects(
    repo.createAuxiliary("home", "source", { id, name: "Empresa" }, key),
    { code: "network" },
  );
  assert.deepEqual(
    await repo.createAuxiliary("home", "source", { id, name: "Empresa" }, key),
    { id },
  );
  assert.equal(posts, 1);
  await assert.rejects(
    repo.createAuxiliary("home", "source", { id, name: "Outra" }, key),
    { code: "conflict" },
  );
});
test("refreshing selector catalogs preserves the transaction fields and chosen source account", async () => {
  const store = createRecordStore(
    { recordOptions: async () => catalog },
    "home",
    "expense",
    "BRL",
    { storage: storage(), randomId: () => id },
  );
  const stop = await start(store);
  store.edit("accountId", "b");
  store.edit("amount", "45,70");
  store.edit("description", "Compras");
  store.retry();
  await tick();
  assert.equal(store.getSnapshot().fields.accountId, "b");
  assert.equal(store.getSnapshot().fields.amount, "45,70");
  assert.equal(store.getSnapshot().fields.description, "Compras");
  stop();
});
