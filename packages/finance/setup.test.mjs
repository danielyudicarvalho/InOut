import test from "node:test";
import assert from "node:assert/strict";
import {
  dashboardSetupState,
  createFinanceRepository,
  createAccountStore,
  initialAccountAmount,
  prepareAccount,
  FinanceFailure,
} from "./index.mjs";
const accountId = "4b00ff2e-1610-4e90-a57f-c8d7d08c73b6",
  key = "3101c507-df25-4fe6-8897-f9222ea5cc54";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const fields = {
  name: "  Carteira  ",
  kind: "cash",
  currency: "brl",
  balance: "-25,50",
  date: "2026-10-28",
};
test("dashboard setup distinguishes no accounts, opening balances, activity outside the period and unknown state", () => {
  const empty = {
    setupAccounts: [],
    accounts: [],
    transactions: [],
    hasFinancialActivity: false,
    isReconciled: true,
  };
  assert.equal(dashboardSetupState(empty), "no-accounts");
  const ready = {
    ...empty,
    setupAccounts: [{ id: "a", balance: 0 }],
    accounts: [{ id: "a" }],
    transactions: [{ kind: "openingBalance" }],
  };
  assert.equal(dashboardSetupState(ready), "no-movements");
  assert.equal(
    dashboardSetupState({
      ...ready,
      transactions: [],
      hasFinancialActivity: true,
    }),
    "active",
  );
  assert.equal(
    dashboardSetupState({ ...ready, hasFinancialActivity: null }),
    "active",
  );
  assert.equal(
    dashboardSetupState({ ...ready, transactions: [{ kind: "transfer" }] }),
    "active",
  );
  assert.equal(
    dashboardSetupState({ ...ready, isReconciled: false }),
    "active",
  );
});
test("home preserves explicit activity metadata and real initial balances instead of current balances", async () => {
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url) => {
      let data;
      if (url.endsWith("/accounts"))
        data = [
          {
            id: "a",
            name: "Carteira",
            kind: "cash",
            currency: "BRL",
            balanceCents: 800,
          },
        ];
      else if (url.includes("/history?")) data = [];
      else
        data = {
          periodStart: "2026-10-01",
          periodEnd: "2026-10-31",
          hasFinancialActivity: false,
          isReconciled: true,
          summaries: [
            {
              currency: "BRL",
              consolidatedBalanceCents: 0,
              incomeCents: 0,
              expenseCents: 0,
              resultCents: 0,
            },
          ],
          accounts: [
            {
              accountId: "a",
              accountName: "Carteira",
              currency: "BRL",
              balanceCents: 0,
              initialBalanceCents: 500,
              inflowCents: 0,
              outflowCents: 0,
              netChangeCents: 0,
            },
          ],
        };
      return new Response(JSON.stringify(data));
    },
  });
  const data = await repo.home("home", "2026-10-01/2026-10-31");
  assert.equal(data.hasFinancialActivity, false);
  assert.equal(data.setupAccounts[0].initialBalance, 500);
  assert.equal(data.setupAccounts[0].balance, 800);
  assert.equal(data.accounts[0].balance, 0);
});
test("initial account amount supports zero and signed cents and prepares an actual account request", () => {
  assert.equal(initialAccountAmount("0,00"), 0);
  assert.equal(initialAccountAmount("-0.01"), -1);
  assert.equal(initialAccountAmount("1250,50"), 125050);
  for (const invalid of ["1.000,00", "1,234", "NaN", "90071992547409,92"])
    assert.throws(() => initialAccountAmount(invalid));
  assert.throws(
    () => prepareAccount({ ...fields, currency: "B" }, accountId),
    (error) => error.code === "validation",
  );
  const body = prepareAccount(fields, accountId.toUpperCase());
  assert.equal(body.id, accountId);
  assert.equal(body.name, "Carteira");
  assert.equal(body.initialBalanceCents, -2550);
  assert.equal(body.currency, "BRL");
  assert.equal(body.openingDate, "2026-10-28");
});
test("account creation is durable and restores the same account id and operation key after an uncertain response", async () => {
  let saved = null,
    attempt = 0;
  const writes = [];
  const storage = {
    load: async () => saved,
    save: async (value) => {
      saved = value;
    },
    remove: async (expected) => {
      if (saved && JSON.parse(saved).key === expected) saved = null;
    },
  };
  const repo = {
    accountOptions: async () => ({ accounts: [], categories: [], sources: [] }),
    createAccount: async (household, body, k) => {
      assert.ok(saved);
      writes.push({ household, body, key: k });
      if (attempt++ === 0) throw new FinanceFailure("network");
      return {
        accountId: body.id,
        currency: body.currency,
        name: body.name,
        replayed: true,
      };
    },
  };
  let ids = 0;
  const store = createAccountStore(repo, "home", "BRL", {
    storage,
    randomId: () => (ids++ === 0 ? accountId : key),
  });
  const stop = store.start();
  await tick();
  assert.equal(writes.length, 0);
  for (const [field, value] of Object.entries(fields)) store.edit(field, value);
  await store.submit();
  assert.equal(store.getSnapshot().status, "uncertain");
  stop();
  const restored = createAccountStore(repo, "home", "USD", {
    storage,
    randomId: () => {
      throw Error("must reuse");
    },
  });
  const cleanup = restored.start();
  await tick();
  assert.equal(restored.getSnapshot().fields.balance, "-25,50");
  assert.equal(restored.getSnapshot().status, "uncertain");
  await restored.submit();
  assert.equal(restored.getSnapshot().status, "success");
  assert.deepEqual(writes[0], writes[1]);
  await tick();
  assert.equal(saved, null);
  cleanup();
});
test("create-account API uses the account endpoint and replays a case-insensitive UUID response", async () => {
  let request;
  const body = prepareAccount(fields, accountId);
  const repo = createFinanceRepository({
    baseUrl: "https://api.example",
    getToken: async () => "jwt",
    fetcher: async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          account: {
            id: accountId.toUpperCase(),
            name: "Carteira",
            currency: "BRL",
          },
          replayed: false,
        }),
        { status: 201 },
      );
    },
  });
  const result = await repo.createAccount("home", body, key);
  assert.equal(result.currency, "BRL");
  assert.equal(
    request.url,
    "https://api.example/api/v1/households/home/ledger/accounts",
  );
  assert.equal(request.init.headers["Idempotency-Key"], key);
  assert.equal(JSON.parse(request.init.body).initialBalanceCents, -2550);
});
