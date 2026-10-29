import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinanceRepository,
  getCorrectionChain,
  createCorrectionChainStore,
} from "./index.mjs";

const origId = "d6b5efbd-1cda-4818-84c7-a682e1078592",
  revId = "086a756c-f66f-48c2-97cb-4b6ce6f9fbe6",
  subId = "e5a8f4c2-9011-4b2a-8c5e-77d12a934101";

const origRow = {
  transactionId: origId,
  kind: "expense",
  status: "reversed",
  description: "Compras da semana",
  reversalOf: null,
  occurredOn: "2026-10-28",
  postedAt: "2026-10-28T10:42:00Z",
  createdBy: "Daniel Yudi",
  accountId: "acc-1",
  accountName: "Conta principal",
  categoryId: "child",
  categoryName: "Mercado",
  direction: "debit",
  amountCents: 32000,
  currency: "BRL",
};

const revRow = {
  transactionId: revId,
  kind: "reversal",
  status: "posted",
  description: "Compensação do lançamento original",
  reversalOf: origId,
  occurredOn: "2026-10-28",
  postedAt: "2026-10-28T10:50:00Z",
  createdBy: "Daniel Yudi",
  accountId: "acc-1",
  accountName: "Conta principal",
  categoryId: null,
  categoryName: null,
  direction: "credit",
  amountCents: 32000,
  currency: "BRL",
};

const subRow = {
  transactionId: subId,
  kind: "expense",
  status: "posted",
  description: "Compras da semana — valor corrigido",
  reversalOf: null,
  occurredOn: "2026-10-28",
  postedAt: "2026-10-28T10:52:00Z",
  createdBy: "Daniel Yudi",
  accountId: "acc-1",
  accountName: "Conta principal",
  categoryId: "child",
  categoryName: "Mercado",
  direction: "debit",
  amountCents: 28000,
  currency: "BRL",
};

function createMockRepo(allRows = [origRow, revRow, subRow]) {
  return createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url) => {
      if (url.endsWith("/households")) {
        return new Response(JSON.stringify([{ id: "h", name: "Casa" }]));
      }
      if (url.includes("/categories?")) {
        return new Response(
          JSON.stringify([
            { id: "root", name: "Alimentação" },
            { id: "child", name: "Mercado", parentId: "root" },
          ]),
        );
      }
      if (url.includes("/history?")) {
        const u = new URL(url);
        const txId = u.searchParams.get("transactionId");
        if (txId) {
          const matched = allRows.filter((r) => r.transactionId === txId);
          return new Response(JSON.stringify(matched));
        }
        return new Response(JSON.stringify(allRows));
      }
      return new Response(JSON.stringify([]));
    },
  });
}

test("getCorrectionChain resolves complete 3-step chain and net effect from any transaction in chain", async () => {
  const repo = createMockRepo();
  const chainFromOrig = await getCorrectionChain(repo, "h", origId);
  assert.equal(chainFromOrig.steps.length, 3);
  assert.equal(chainFromOrig.steps[0].kind, "original");
  assert.equal(chainFromOrig.steps[0].statusBadge, "Estornado");
  assert.equal(chainFromOrig.steps[0].detail.amount, -32000);

  assert.equal(chainFromOrig.steps[1].kind, "reversal");
  assert.equal(chainFromOrig.steps[1].statusBadge, "Registrado");
  assert.equal(chainFromOrig.steps[1].detail.amount, 32000);

  assert.equal(chainFromOrig.steps[2].kind, "substitute");
  assert.equal(chainFromOrig.steps[2].statusBadge, "Registrado");
  assert.equal(chainFromOrig.steps[2].detail.amount, -28000);

  assert.equal(chainFromOrig.netAmount, -28000);
  assert.match(chainFromOrig.netLabel, /saída de R\$\s*280,00/);

  // Resolving from reversal transaction also gives the full chain
  const chainFromRev = await getCorrectionChain(repo, "h", revId);
  assert.equal(chainFromRev.steps.length, 3);
  assert.equal(chainFromRev.netAmount, -28000);
});

test("createCorrectionChainStore handles state transitions and notifications", async () => {
  const repo = createMockRepo();
  const store = createCorrectionChainStore(repo, "h", origId);
  let calls = 0;
  const unsub = store.subscribe(() => {
    calls++;
  });
  store.start();
  await new Promise((r) => setTimeout(r, 50));
  const snap = store.getSnapshot();
  assert.equal(snap.status, "ready");
  assert.ok(snap.chain);
  assert.equal(snap.chain.steps.length, 3);
  assert.ok(calls >= 2);
  unsub();
});
