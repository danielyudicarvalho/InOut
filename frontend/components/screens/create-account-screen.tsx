"use client";
import { type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useFinancialHome } from "../../lib/finance/use-financial-home";
import { useAccount } from "../../lib/finance/use-account";
export function CreateAccountScreen() {
  const p = useSearchParams(),
    household = p.get("household") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "BRL";
  return (
    <AccountView
      key={`${household}:${period}:${currency}`}
      household={household}
      period={period}
      currency={currency}
    />
  );
}
function AccountView({
  household,
  period,
  currency,
}: {
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
        <h1>Criar conta financeira</h1>
        <p role="status">
          {home.status === "loading"
            ? "Carregando residência…"
            : home.notice || "Escolha uma residência antes de criar a conta."}
        </p>
        {home.status !== "loading" ? (
          <button onClick={home.retry}>Tentar novamente</button>
        ) : null}
        <Link href="/comecar">Escolher residência</Link>
      </main>
    );
  return (
    <AccountForm
      household={home.householdId}
      period={home.period}
      currency={currency}
      householdName={
        home.households.find((h) => h.id === home.householdId)?.name ??
        "Residência"
      }
    />
  );
}
function AccountForm({
  household,
  period,
  currency,
  householdName,
}: {
  household: string;
  period: string;
  currency: string;
  householdName: string;
}) {
  const state = useAccount(household, currency),
    back = `/inicio?${new URLSearchParams({ household, period, currency })}`;
  if (state.status === "loading" || state.status === "error")
    return (
      <main className="financial-state">
        <h1>Criar conta financeira</h1>
        <p role="status">
          {state.status === "loading" ? "Carregando…" : state.notice}
        </p>
        {state.status === "error" ? (
          <button onClick={state.retry}>Tentar novamente</button>
        ) : null}
        <Link href={back}>Voltar ao início</Link>
      </main>
    );
  const fields = state.fields,
    locked = state.status !== "ready",
    context = {
      household,
      period: fields.date.slice(0, 7),
      currency: fields.currency.trim().toUpperCase(),
    };
  const homeHref = `/inicio?${new URLSearchParams(context)}`;
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
            src={
              state.status === "success"
                ? "/images/pipo-first-account-success.webp"
                : "/images/pipo-empty-accounts.webp"
            }
            width={600}
            height={300}
            alt={
              state.status === "success"
                ? "Pipo comemorando a conta criada"
                : "Pipo preparando seu ninho"
            }
            sizes="260px"
          />
          <p>{householdName}</p>
          <h1>
            {state.status === "success"
              ? "Seu Ninho está pronto para começar"
              : "Criar conta financeira"}
          </h1>
          <p>
            Conta financeira é onde seu dinheiro fica. Pode ser sua carteira,
            conta corrente ou poupança.
          </p>
        </header>
        {state.status === "success" ? (
          <>
            <p role="status">Conta criada com sucesso.</p>
            <div className="setup-actions">
              <Link
                className="primary"
                href={`/novo-registro?${new URLSearchParams({ ...context, kind: "income" })}`}
              >
                Registrar entrada
              </Link>
              <Link
                className="setup-expense-action"
                href={`/novo-registro?${new URLSearchParams({ ...context, kind: "expense" })}`}
              >
                Registrar saída
              </Link>
            </div>
            <Link className="balance-back" href={homeHref}>
              Ir para o início
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            {state.notice ? (
              <p role="alert" className="record-notice">
                {state.notice}
              </p>
            ) : null}
            <fieldset disabled={locked}>
              <label>
                Nome da conta
                <input
                  required
                  maxLength={80}
                  placeholder="Minha conta principal"
                  value={fields.name}
                  onChange={(e) => state.edit("name", e.target.value)}
                />
              </label>
              <label>
                Tipo
                <select
                  value={fields.kind}
                  onChange={(e) => state.edit("kind", e.target.value)}
                >
                  {[
                    ["checking", "Conta corrente"],
                    ["cash", "Carteira"],
                    ["savings", "Poupança"],
                    ["investment", "Investimento"],
                    ["other", "Outro"],
                  ].map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Moeda
                <input
                  required
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  placeholder="BRL"
                  value={fields.currency}
                  onChange={(e) =>
                    state.edit("currency", e.target.value.toUpperCase())
                  }
                />
                <small>Código de três letras, como BRL, USD ou EUR.</small>
              </label>
              <label>
                Saldo inicial
                <input
                  required
                  inputMode="decimal"
                  placeholder="0,00"
                  value={fields.balance}
                  onChange={(e) => state.edit("balance", e.target.value)}
                />
                <small>
                  O saldo inicial é o dinheiro que você já tinha. Pode ser zero
                  ou negativo.
                </small>
              </label>
              <label>
                Data do saldo inicial
                <input
                  required
                  type="date"
                  min="2000-01-01"
                  max="9998-12-31"
                  value={fields.date}
                  onChange={(e) => state.edit("date", e.target.value)}
                />
              </label>
            </fieldset>
            <button
              className="primary record-submit"
              type="submit"
              disabled={state.status === "saving"}
            >
              {state.status === "saving"
                ? "Salvando…"
                : state.status === "uncertain"
                  ? "Verificar tentativa pendente"
                  : "Criar conta"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
