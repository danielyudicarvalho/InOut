import test from "node:test";
import assert from "node:assert/strict";
import { recordReview, createRecordStore } from "./index.mjs";
const options = {
  accounts: [
    { id: "a", name: "Principal", currency: "BRL" },
    { id: "b", name: "Reserva", currency: "BRL" },
  ],
  categories: [
    { id: "root", name: "Alimentação", flow: "expense" },
    { id: "child", name: "Mercado", flow: "expense", parentId: "root" },
    { id: "salary", name: "Salário", flow: "income" },
  ],
  sources: [{ id: "work", name: "Empresa" }],
};
const fields = {
  accountId: "a",
  destinationId: "b",
  categoryId: "child",
  sourceId: "",
  amount: "320,00",
  date: "2026-10-28",
  description: "  Compras da semana  ",
};
test("expense review reflects exact validated amount, hierarchy, description and account data", () => {
  const review = recordReview("expense", fields, options);
  assert.equal(review.amount, 32000);
  assert.equal(review.currency, "BRL");
  assert.deepEqual(
    review.rows.map((r) => r.value),
    [
      "Principal",
      "BRL",
      "Alimentação",
      "Mercado",
      "28/10/2026",
      "Compras da semana",
    ],
  );
  assert.equal(fields.description, "  Compras da semana  ");
});
test("income and transfer review use their actual contracts and omit unrelated classification", () => {
  const income = recordReview(
    "income",
    { ...fields, categoryId: "salary", sourceId: "work" },
    options,
  );
  assert.equal(
    income.rows.find((r) => r.label === "Fonte de renda").value,
    "Empresa",
  );
  const transfer = recordReview("transfer", fields, options);
  assert.equal(
    transfer.rows.find((r) => r.label === "Conta de destino").value,
    "Reserva",
  );
  assert.equal(
    transfer.rows.some((r) => r.label === "Categoria"),
    false,
  );
  assert.equal(
    transfer.rows.some((r) => r.label === "Fonte de renda"),
    false,
  );
});
test("invalid review never bypasses amount, category flow or transfer validation", () => {
  assert.throws(
    () => recordReview("expense", { ...fields, amount: "0" }, options),
    { code: "validation" },
  );
  assert.throws(() => recordReview("income", fields, options), {
    code: "validation",
  });
  assert.throws(
    () => recordReview("transfer", { ...fields, destinationId: "a" }, options),
    { code: "validation" },
  );
});
test("review and edit do not persist or POST; explicit submission sends the reviewed values", async () => {
  let saved = null,
    posts = 0,
    posted;
  const store = createRecordStore(
    {
      recordOptions: async () => options,
      postRecord: async (h, k, body) => {
        posts++;
        posted = body;
        return { transactionId: "t", replayed: false };
      },
    },
    "home",
    "expense",
    "BRL",
    {
      storage: {
        load: async () => saved,
        save: async (value) => {
          saved = value;
        },
        remove: async () => {
          saved = null;
        },
      },
      randomId: () => "721eb2c9-d5d6-49e7-bd6d-453118b68d63",
    },
  );
  const stop = store.start();
  await new Promise((r) => setTimeout(r, 0));
  for (const [key, value] of Object.entries(fields)) store.edit(key, value);
  let review = recordReview(
    "expense",
    store.getSnapshot().fields,
    store.getSnapshot().options,
  );
  assert.equal(saved, null);
  assert.equal(posts, 0);
  store.edit("amount", "150,25");
  review = recordReview(
    "expense",
    store.getSnapshot().fields,
    store.getSnapshot().options,
  );
  assert.equal(posts, 0);
  assert.equal(saved, null);
  await store.submit();
  assert.equal(posts, 1);
  assert.equal(posted.amountCents, review.amount);
  assert.equal(
    posted.description,
    review.rows.find((r) => r.label === "Descrição").value,
  );
  stop();
});
