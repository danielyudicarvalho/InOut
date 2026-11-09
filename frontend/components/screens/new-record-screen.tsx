"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  recordReview,
  type RecordFields,
  type RecordKind,
  type RecordReview,
} from "@inout/finance";
import { useFinancialHome } from "../../lib/finance/use-financial-home";
import { useRecord } from "../../lib/finance/use-record";
import { DashboardSidebar } from "../layout/dashboard-sidebar";
import { RecordSaved } from "../financial/records/record-saved";
import { PendingVerificationScreen } from "./pending-verification-screen";
import { NewRecordPicker } from "../financial/records/new-record-picker";
import { RecordReviewPanel } from "../financial/records/record-review";
import { RecordHeader, recordTitles } from "../financial/records/record-header";
import { RecordForm } from "../financial/records/record-form";

export function NewRecordScreen() {
  const p = useSearchParams();
  const kind = p.get("kind") ?? "";
  const household = p.get("household") ?? "";
  const period = p.get("period") ?? "";
  const currency = p.get("currency") ?? "";

  if (!["income", "expense", "transfer"].includes(kind)) {
    return (
      <main className="financial-state">
        <h1>Tipo de movimentação inválido</h1>
        <Link href="/inicio">Voltar ao início</Link>
      </main>
    );
  }

  return (
    <RecordView
      key={`${kind}:${household}:${period}:${currency}:${p.get("draft") ?? ""}`}
      kind={kind as RecordKind}
      household={household}
      period={period}
      currency={currency}
    />
  );
}

function RecordView({
  kind,
  household,
  period,
  currency,
}: {
  kind: RecordKind;
  household: string;
  period: string;
  currency: string;
}) {
  const home = useFinancialHome({
    initialHouseholdId: household,
    initialPeriod: period,
  });

  if (home.status !== "ready" || !home.data) {
    return (
      <main className="financial-state">
        <h1>{recordTitles[kind]}</h1>
        <p role="status">
          {home.status === "loading"
            ? "Carregando residência…"
            : home.notice || "Nenhuma residência disponível."}
        </p>
        {home.status !== "loading" ? (
          <button onClick={home.retry}>Tentar novamente</button>
        ) : null}
        <Link href="/inicio">Voltar ao início</Link>
      </main>
    );
  }

  const activeHousehold = home.households.find(
    (row) => row.id === home.householdId,
  );

  return (
    <RecordScreenContent
      household={home.householdId}
      kind={kind}
      period={home.period}
      currency={currency}
      householdName={activeHousehold?.name ?? "Residência"}
    />
  );
}

function RecordScreenContent({
  household,
  kind,
  period,
  currency,
  householdName,
}: {
  household: string;
  kind: RecordKind;
  period: string;
  currency: string;
  householdName: string;
}) {
  const state = useRecord(household, kind, currency);
  const [reviewing, setReviewing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [, setFocusField] = useState<keyof RecordFields | null>(null);

  const backHref = `/lancamentos?${new URLSearchParams({ household, period, currency })}`;

  if (
    state.status === "loading" ||
    state.status === "error" ||
    !state.options
  ) {
    return (
      <main className="financial-state">
        <h1>{recordTitles[kind]}</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando contas e categorias…"
            : state.notice}
        </p>
        {state.status === "error" ? (
          <button onClick={state.retry}>Tentar novamente</button>
        ) : null}
        <Link href={backHref}>Voltar ao início</Link>
      </main>
    );
  }

  const { options, fields } = state;
  const account = options.accounts.find((row) => row.id === fields.accountId);
  const categories = options.categories.filter(
    (row) => row.flow === state.kind,
  );
  const destinations = options.accounts.filter(
    (row) => row.id !== fields.accountId && row.currency === account?.currency,
  );

  const unavailable =
    !options.accounts.length ||
    (state.kind === "transfer"
      ? destinations.length === 0
      : categories.length === 0);

  const showReview =
    (reviewing && state.status !== "success") ||
    state.status === "uncertain" ||
    state.status === "saving";

  let summary: RecordReview | null = null;
  if (showReview || state.status === "success") {
    try {
      summary = recordReview(state.kind, fields, options);
    } catch {
      /* A pending operation can reference an archived option. Its original payload remains available for retry. */
    }
  }

  const savedParams = new URLSearchParams({
    household,
    period: fields.date.slice(0, 7),
    currency: account?.currency ?? currency,
  });
  const historyHref = `/lancamentos?${savedParams}`;
  const detailHref = `/lancamento?${savedParams}&transaction=${encodeURIComponent(state.result?.transactionId ?? "")}`;

  // Uncertain state -> Pending Verification Screen
  if (state.status === "uncertain") {
    return (
      <PendingVerificationScreen
        household={household}
        householdName={householdName}
        kind={state.kind}
        summary={summary}
        description={fields.description}
        amount={fields.amount}
        currency={account?.currency ?? currency}
        accountName={account?.name ?? ""}
        date={fields.date}
        historyHref={historyHref}
        onRetry={() => void state.submit()}
        submitting={false}
      />
    );
  }

  return (
    <main
      className={`record-page ${state.status === "success" ? "record-saved-layout" : ""} record-income-layout ${
        state.kind === "expense"
          ? "record-expense-layout"
          : state.kind === "transfer"
            ? "record-transfer-layout"
            : ""
      }`}
    >
      <DashboardSidebar
        household={household}
        householdName={householdName}
        period={period}
        currency={currency}
        activePage="lancamentos"
        quote="Grandes conquistas também nascem de pequenos registros. ♡"
      />

      <div className="record-main">
        <section className="dashboard-panel record-form-panel">
          <RecordHeader
            kind={state.kind}
            householdName={householdName}
            backHref={backHref}
            showReview={showReview}
            status={state.status}
            onBackToEdit={() => {
              setReviewing(false);
              setFocusField("amount");
            }}
          />

          {state.status === "success" ? (
            <RecordSaved
              kind={state.kind}
              summary={summary}
              description={fields.description}
              transactionId={state.result!.transactionId}
              historyHref={historyHref}
              detailHref={detailHref}
              onNew={() => setNewOpen(true)}
            />
          ) : showReview ? (
            <RecordReviewPanel
              kind={state.kind}
              summary={summary}
              status={state.status}
              notice={state.notice}
              onEdit={(field) => {
                setReviewing(false);
                setFocusField(field ?? "amount");
              }}
              onConfirm={() => void state.submit()}
            />
          ) : (
            <RecordForm
              kind={state.kind}
              household={household}
              currency={currency}
              backHref={backHref}
              status={state.status}
              notice={state.notice}
              fields={fields}
              accounts={options.accounts}
              categories={categories}
              sources={options.sources}
              account={account}
              destinations={destinations}
              unavailable={unavailable}
              onEdit={state.edit}
              onRetry={state.retry}
              onReview={() => setReviewing(true)}
            />
          )}
        </section>
      </div>

      {newOpen && (
        <NewRecordPicker
          household={household}
          period={fields.date.slice(0, 7)}
          currency={account?.currency ?? currency}
          fresh
          onClose={() => setNewOpen(false)}
        />
      )}
    </main>
  );
}
