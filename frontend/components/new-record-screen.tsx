"use client";
import { type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { type RecordKind } from "@inout/finance";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import { useRecord } from "../lib/finance/use-record";
const titles = {
  income: "Nova entrada",
  expense: "Nova saída",
  transfer: "Transferência",
};
export function NewRecordScreen() {
  const p = useSearchParams(),
    kind = p.get("kind") ?? "",
    household = p.get("household") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "";
  if (!["income", "expense", "transfer"].includes(kind))
    return (
      <main className="financial-state">
        <h1>Tipo de movimentação inválido</h1>
        <Link href="/inicio">Voltar ao início</Link>
      </main>
    );
  return (
    <RecordView
      key={`${kind}:${household}:${period}:${currency}`}
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
  if (home.status !== "ready" || !home.data)
    return (
      <main className="financial-state">
        <h1>{titles[kind]}</h1>
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
  return (
    <RecordForm
      household={home.householdId}
      kind={kind}
      period={home.period}
      currency={currency}
      householdName={
        home.households.find((row) => row.id === home.householdId)?.name ??
        "Residência"
      }
    />
  );
}
function RecordForm({
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
  const back = `/inicio?${new URLSearchParams({ household, period, currency })}`;
  if (state.status === "loading" || state.status === "error" || !state.options)
    return (
      <main className="financial-state">
        <h1>{titles[kind]}</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando contas e categorias…"
            : state.notice}
        </p>
        {state.status === "error" ? (
          <button onClick={state.retry}>Tentar novamente</button>
        ) : null}
        <Link href={back}>Voltar ao início</Link>
      </main>
    );
  const options = state.options,
    fields = state.fields,
    locked = state.status !== "ready",
    account = options.accounts.find((row) => row.id === fields.accountId);
  const categories = options.categories.filter(
      (row) => row.flow === state.kind,
    ),
    destinations = options.accounts.filter(
      (row) =>
        row.id !== fields.accountId && row.currency === account?.currency,
    );
  const unavailable =
    !options.accounts.length ||
    (state.kind === "transfer"
      ? destinations.length === 0
      : categories.length === 0);
  const successHref = `/inicio?${new URLSearchParams({ household, period: fields.date.slice(0, 7), currency: account?.currency ?? currency })}`;
  function submit(event: FormEvent) {
    event.preventDefault();
    void state.submit();
  }
  return (
    <main className="record-page">
      <section className="dashboard-panel record-form-panel">
        <header>
          <Link className="balance-back" href={back}>
            ‹ Voltar ao início
          </Link>
          <Image
            src="/images/pipo-new-record.webp"
            width={600}
            height={300}
            sizes="260px"
            alt="Pipo escrevendo em um caderno"
          />
          <p>{householdName}</p>
          <h1>{titles[state.kind]}</h1>
          <p>
            {state.kind === "transfer"
              ? "Mova dinheiro entre suas contas. Transferências não contam como receita ou despesa."
              : "Informe os dados do lançamento."}
          </p>
        </header>
        {state.status === "success" ? (
          <div>
            <p role="status">Registro salvo com sucesso.</p>
            <Link className="primary record-success" href={successHref}>
              Ver o período do lançamento
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {state.notice ? (
              <p role="alert" className="record-notice">
                {state.notice}
              </p>
            ) : null}
            {unavailable && !locked ? (
              <p role="alert">
                {!options.accounts.length
                  ? "Crie uma conta financeira antes de registrar."
                  : state.kind === "transfer"
                    ? "Uma transferência precisa de duas contas diferentes na mesma moeda."
                    : "Cadastre uma categoria correspondente a este tipo de movimentação antes de registrar."}
              </p>
            ) : null}
            <fieldset disabled={locked}>
              <label>
                {state.kind === "transfer" ? "Conta de origem" : "Conta"}
                <select
                  required
                  value={fields.accountId}
                  onChange={(e) => state.edit("accountId", e.target.value)}
                >
                  <option value="">Selecione</option>
                  {options.accounts.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.currency}
                    </option>
                  ))}
                </select>
              </label>
              {state.kind === "transfer" ? (
                <label>
                  Conta de destino
                  <select
                    required
                    value={fields.destinationId}
                    onChange={(e) =>
                      state.edit("destinationId", e.target.value)
                    }
                  >
                    <option value="">Selecione</option>
                    {destinations.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} · {row.currency}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  Categoria
                  <select
                    required
                    value={fields.categoryId}
                    onChange={(e) => state.edit("categoryId", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {categories.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {state.kind === "income" ? (
                <label>
                  Fonte de renda (opcional)
                  <select
                    value={fields.sourceId}
                    onChange={(e) => state.edit("sourceId", e.target.value)}
                  >
                    <option value="">Sem fonte de renda</option>
                    {options.sources.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Valor {account ? `(${account.currency})` : ""}
                <input
                  required
                  inputMode="decimal"
                  placeholder="1250,50"
                  value={fields.amount}
                  onChange={(e) => state.edit("amount", e.target.value)}
                />
                <small>
                  Use vírgula ou ponto para os centavos, sem separador de
                  milhar.
                </small>
              </label>
              <label>
                Data
                <input
                  required
                  type="date"
                  min="2000-01-01"
                  max="9998-12-31"
                  value={fields.date}
                  onChange={(e) => state.edit("date", e.target.value)}
                />
              </label>
              <label>
                Descrição (opcional)
                <textarea
                  maxLength={500}
                  value={fields.description}
                  onChange={(e) => state.edit("description", e.target.value)}
                />
              </label>
            </fieldset>
            <button
              className="primary record-submit"
              type="submit"
              disabled={
                state.status === "saving" ||
                (state.status === "ready" && unavailable)
              }
            >
              {state.status === "saving"
                ? "Salvando…"
                : state.status === "uncertain"
                  ? "Verificar tentativa pendente"
                  : state.kind === "income"
                    ? "Salvar entrada"
                    : state.kind === "expense"
                      ? "Salvar saída"
                      : "Salvar transferência"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
