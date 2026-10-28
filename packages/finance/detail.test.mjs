import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinanceRepository,
  createReversalStore,
  canReverse,
  FinanceFailure,
} from "./index.mjs";
const id = "d6b5efbd-1cda-4818-84c7-a682e1078592",
  reverseId = "086a756c-f66f-48c2-97cb-4b6ce6f9fbe6",
  key = "debd183b-1474-4e1f-84b1-cbf8c55b4102";
const row = {
  transactionId: id,
  kind: "expense",
  status: "posted",
  description: "Compras",
  reversalOf: null,
  occurredOn: "2026-10-28",
  postedAt: "2026-10-28T10:42:00Z",
  createdBy: "92bcf60b-173b-4ec0-ab0f-6f405eb61db9",
  accountId: "a",
  accountName: "Principal",
  categoryId: "child",
  categoryName: "Mercado",
  direction: "debit",
  amountCents: 32000,
  currency: "BRL",
};
function repo(rows, calls = [], homes = [{ id: "h", name: "Casa" }]) {
  return createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify(
          url.endsWith("/households")
            ? homes
            : url.includes("/categories?")
              ? [
                  { id: "root", name: "Alimentação" },
                  { id: "child", name: "Mercado", parentId: "root" },
                ]
              : rows,
        ),
      );
    },
  });
}
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
test("detail reads exact authorized transaction without a period restriction and preserves audit and signed amount", async () => {
  const calls = [],
    detail = await repo([row], calls).transaction("h", id);
  assert.equal(detail.amount, -32000);
  assert.equal(detail.createdBy, row.createdBy);
  assert.equal(detail.postedAt, row.postedAt);
  assert.equal(
    detail.rows.find((r) => r.label === "Categoria").value,
    "Alimentação",
  );
  assert.equal(
    detail.rows.find((r) => r.label === "Subcategoria").value,
    "Mercado",
  );
  assert.equal(canReverse(detail), true);
  const url = new URL(calls.find((c) => c.url.includes("/history?")).url);
  assert.equal(url.searchParams.get("transactionId"), id);
  assert.equal(url.searchParams.has("from"), false);
});
test("detail denies foreign households, missing ids, mismatched rows and inconsistent transfer legs", async () => {
  const calls = [];
  await assert.rejects(repo([], calls, []).transaction("other", id), {
    code: "forbidden",
  });
  assert.equal(calls.length, 1);
  await assert.rejects(repo([]).transaction("h", id), { code: "not_found" });
  await assert.rejects(
    repo([{ ...row, transactionId: reverseId }]).transaction("h", id),
    { code: "invalid" },
  );
  await assert.rejects(
    repo([
      { ...row, kind: "transfer" },
      {
        ...row,
        kind: "transfer",
        accountId: "b",
        direction: "credit",
        amountCents: 100,
      },
    ]).transaction("h", id),
    { code: "invalid" },
  );
});
test("transfer detail preserves both accounts, uses the transferred amount and prevents reversal of reversal", async () => {
  const detail = await repo([
    { ...row, kind: "transfer", categoryName: null },
    {
      ...row,
      kind: "transfer",
      categoryName: null,
      direction: "credit",
      accountId: "b",
      accountName: "Reserva",
    },
  ]).transaction("h", id);
  assert.equal(detail.amount, 32000);
  assert.equal(detail.postings.length, 2);
  assert.deepEqual(
    detail.rows.slice(0, 2).map((r) => r.value),
    ["Principal", "Reserva"],
  );
  assert.equal(canReverse({ ...detail, kind: "reversal" }), false);
  assert.equal(canReverse({ ...detail, status: "reversed" }), false);
});
test("reverse endpoint sends the actual contract with bearer token and original idempotency key", async () => {
  let request;
  const repository = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({ transactionId: reverseId, replayed: true }),
      );
    },
  });
  const body = { occurredOn: "2026-10-28", description: "Correção" };
  assert.equal(
    (await repository.reverse("h", id, body, key)).transactionId,
    reverseId,
  );
  assert.equal(
    request.url,
    `https://api.example/api/v1/households/h/ledger/transactions/${id}/reversals`,
  );
  assert.equal(request.init.headers["Idempotency-Key"], key);
  assert.equal(request.init.headers.Authorization, "Bearer jwt");
  assert.deepEqual(JSON.parse(request.init.body), body);
});
test("detail load and edits never reverse; explicit confirmation persists before POST and replays the same uncertain operation", async () => {
  const saved = storage(),
    calls = [];
  let fail = true,
    originalReversed = false;
  const repository = {
    transaction: async () => ({
      ...row,
      id,
      kind: "expense",
      status: originalReversed ? "reversed" : "posted",
    }),
    reverse: async (...args) => {
      assert.ok(saved.peek());
      calls.push(args.slice(0, 4));
      originalReversed = true;
      if (fail) throw new FinanceFailure("network");
      return { transactionId: reverseId, replayed: true };
    },
  };
  let store = createReversalStore(repository, "h", id, {
      storage: saved,
      randomId: () => key,
    }),
    stop = store.start();
  await tick();
  assert.equal(calls.length, 0);
  store.edit("description", " Correção ");
  store.edit("date", "2026-10-28");
  assert.equal(saved.peek(), null);
  await store.submit();
  assert.equal(store.getSnapshot().status, "uncertain");
  stop();
  store = createReversalStore(repository, "h", id, {
    storage: saved,
    randomId: () => key,
  });
  stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().status, "uncertain");
  assert.equal(store.getSnapshot().options.status, "reversed");
  store.edit("date", "2026-11-01");
  fail = false;
  await store.submit();
  assert.equal(store.getSnapshot().status, "success");
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[0][2], {
    occurredOn: "2026-10-28",
    description: "Correção",
  });
  stop();
});
test("a new reversal is blocked for a reversal or an already reversed transaction", async () => {
  for (const detail of [
    { kind: "reversal", status: "posted" },
    { kind: "expense", status: "reversed" },
  ]) {
    let writes = 0;
    const store = createReversalStore(
      {
        transaction: async () => detail,
        reverse: async () => {
          writes++;
        },
      },
      "h",
      id,
      { storage: storage(), randomId: () => key },
    );
    const stop = store.start();
    await tick();
    await store.submit();
    assert.equal(writes, 0);
    assert.equal(store.getSnapshot().status, "ready");
    stop();
  }
});

test("transfer accounts keep debit as origin when the backend returns credit first", async () => {
  const debit = {
    ...row,
    kind: "transfer",
    categoryId: null,
    categoryName: null,
  };
  const credit = {
    ...debit,
    accountId: "b",
    accountName: "Reserva",
    direction: "credit",
  };
  const detail = await repo([credit, debit]).transaction("h", id);
  assert.equal(detail.kind, "transfer");
  assert.equal(detail.amount, 32000);
  assert.deepEqual(
    detail.postings.map((p) => [p.accountName, p.amount]),
    [
      ["Principal", -32000],
      ["Reserva", 32000],
    ],
  );
  assert.deepEqual(
    detail.rows.slice(0, 2).map((r) => r.label),
    ["Conta de origem", "Conta de destino"],
  );
  assert.equal(
    detail.rows.some((r) => r.label === "Categoria"),
    false,
  );
});
test("confirming a transfer reversal submits one transaction operation, never separate account writes", async () => {
  const detail = await repo([
    { ...row, kind: "transfer", categoryName: null },
    {
      ...row,
      kind: "transfer",
      categoryName: null,
      direction: "credit",
      accountId: "b",
      accountName: "Reserva",
    },
  ]).transaction("h", id);
  const calls = [],
    saved = storage();
  const store = createReversalStore(
    {
      transaction: async () => detail,
      reverse: async (...args) => {
        assert.ok(saved.peek());
        calls.push(args.slice(0, 4));
        return { transactionId: reverseId, replayed: false };
      },
    },
    "h",
    id,
    { storage: saved, randomId: () => key },
  );
  const stop = store.start();
  await tick();
  store.edit("date", "2026-10-28");
  assert.equal(calls.length, 0);
  await Promise.all([store.submit(), store.submit()]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    "h",
    id,
    { occurredOn: "2026-10-28", description: null },
    key,
  ]);
  assert.equal(store.getSnapshot().status, "success");
  stop();
});

test("transfer detail rejects a missing leg or two legs on the same account", async () => {
  const debit = { ...row, kind: "transfer", categoryName: null };
  await assert.rejects(repo([debit]).transaction("h", id), { code: "invalid" });
  await assert.rejects(
    repo([debit, { ...debit, direction: "credit" }]).transaction("h", id),
    { code: "invalid" },
  );
});

test("opening balance detail preserves account, reference date, audit and signed position without classifying it as income", async () => {
  for (const [direction, expected] of [
    ["credit", 32000],
    ["debit", -32000],
  ]) {
    const detail = await repo([
      {
        ...row,
        kind: "openingBalance",
        direction,
        categoryId: null,
        categoryName: null,
        description: "Saldo inicial",
      },
    ]).transaction("h", id);
    assert.equal(detail.kind, "openingbalance");
    assert.equal(detail.amount, expected);
    assert.equal(detail.postings[0].accountId, row.accountId);
    assert.equal(detail.createdBy, row.createdBy);
    assert.equal(detail.postedAt, row.postedAt);
    assert.deepEqual(
      detail.rows.map((r) => r.label),
      ["Conta", "Moeda", "Data de referência", "Descrição"],
    );
    assert.equal(
      detail.rows.find((r) => r.label === "Data de referência").value,
      "28/10/2026",
    );
  }
});
test("opening balance detail rejects multiple account postings", async () => {
  const opening = { ...row, kind: "openingBalance", categoryName: null };
  await assert.rejects(
    repo([
      opening,
      { ...opening, accountId: "b", direction: "credit" },
    ]).transaction("h", id),
    { code: "invalid" },
  );
});
