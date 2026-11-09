import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinanceRepository,
  createRecordFormTracker,
  setFinanceTelemetry,
} from "./index.mjs";
import { createAccountsRepository } from "./accounts.mjs";
import { commandFromPath } from "./telemetry.mjs";

const household = "9f8e7d6c-5b4a-4321-8fed-cba987654321";

test("commandFromPath keeps the route shape and drops ids and queries", () => {
  assert.equal(
    commandFromPath(
      `/api/v1/households/${household}/ledger/transactions/3fa85f64-5717-4562-b3fc-2c963f66afa6/reversals?x=1`,
      "POST",
    ),
    "post ledger/transactions/reversals",
  );
  assert.equal(
    commandFromPath(
      `/api/v1/households/${encodeURIComponent(household)}/ledger/expenses`,
    ),
    "post ledger/expenses",
  );
});

test("a failed write reports a categorical failure; reads report nothing", async () => {
  const seen = [];
  setFinanceTelemetry((event, properties) => seen.push({ event, properties }));
  try {
    const repository = createAccountsRepository({
      baseUrl: "https://api.example",
      getToken: async () => "token",
      fetcher: async () => new Response("{}", { status: 503 }),
    });
    await assert.rejects(repository.list(household));
    assert.equal(seen.length, 0);
    await assert.rejects(
      repository.edit(
        household,
        "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "Conta secreta",
        "checking",
      ),
    );
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0], {
      event: "financial_command_failed",
      properties: {
        command: "put ledger/accounts",
        error_code: "server",
        is_retryable: true,
        outcome_known: false,
      },
    });
    assert.ok(!JSON.stringify(seen).includes("Conta secreta"));
  } finally {
    setFinanceTelemetry(null);
  }
});

test("a throwing sink never breaks the financial call", async () => {
  setFinanceTelemetry(() => {
    throw new Error("sink down");
  });
  try {
    const repository = createFinanceRepository({
      baseUrl: "https://api.example",
      getToken: async () => "token",
      fetcher: async () => new Response("{}", { status: 400 }),
    });
    await assert.rejects(
      repository.createIncomeSource(
        household,
        { name: "x" },
        "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      ),
      (error) => error.code === "validation",
    );
  } finally {
    setFinanceTelemetry(null);
  }
});

test("record form tracker times a submitted form without field values", () => {
  let clock = 1000;
  const seen = [];
  const tracker = createRecordFormTracker({
    kind: "expense",
    now: () => clock,
    emit: (event, properties) => seen.push([event, properties]),
  });
  tracker.edit("amount");
  tracker.start();
  tracker.start();
  tracker.edit("amount");
  tracker.edit("description");
  clock = 13_500;
  tracker.submit();
  tracker.submit();
  tracker.close();
  assert.deepEqual(seen, [
    ["record_form_started", { kind: "expense" }],
    [
      "record_form_submitted",
      { kind: "expense", duration_ms: 12_500, field_edit_count: 2 },
    ],
  ]);
});

test("record form tracker reports abandonment only after input", () => {
  const seen = [];
  const emit = (event, properties) => seen.push([event, properties]);
  const untouched = createRecordFormTracker({
    kind: "income",
    emit,
    now: () => 0,
  });
  untouched.start();
  untouched.close();
  let clock = 0;
  const touched = createRecordFormTracker({
    kind: "transfer",
    emit,
    now: () => clock,
  });
  touched.start();
  touched.edit("destinationId");
  clock = 4_000;
  touched.close();
  touched.close();
  assert.deepEqual(
    seen.map(([event]) => event),
    ["record_form_started", "record_form_started", "record_form_abandoned"],
  );
  assert.deepEqual(seen[2][1], {
    kind: "transfer",
    duration_ms: 4_000,
    last_step: "destinationId",
  });
});
