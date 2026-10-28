"use client";
import { BrandLogo } from "./brand-logo";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { House, Wallet, ChartBar, ArrowLeft } from "@phosphor-icons/react";
import { money, periodLabel, type IncomeItem } from "@inout/finance";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import { useIncomeDetails } from "../lib/finance/use-income-details";
import { PeriodPicker } from "./period-picker";
export function IncomeScreen() {
  const p = useSearchParams(),
    household = p.get("household") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "";
  return (
    <IncomeView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function IncomeView({
  initialCurrency,
  ...options
}: {
  initialHouseholdId: string;
  initialPeriod: string;
  initialCurrency: string;
}) {
  const state = useFinancialHome(options),
    [chosen, setCurrency] = useState(initialCurrency),
    [picker, setPicker] = useState(false);
  if (state.status !== "ready" || !state.data || !state.data.currencies.length)
    return (
      <main className="financial-state">
        <h1>Detalhamento de receitas</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando receitas…"
            : state.status === "error"
              ? state.notice
              : "Nenhuma conta financeira disponível nesta residência."}
        </p>
        {state.status !== "loading" ? (
          <button className="primary" onClick={state.retry}>
            Atualizar
          </button>
        ) : null}
        <Link href="/inicio">Voltar ao início</Link>
      </main>
    );
  const data = state.data,
    currency = data.currencies.includes(chosen) ? chosen : data.currencies[0];
  const homeHref = `/inicio?${new URLSearchParams({ household: state.householdId, period: state.period, currency })}`;
  return (
    <main className="dashboard income-page">
      <aside className="dashboard-sidebar">
        <Link href={homeHref} className="dashboard-brand">
          <BrandLogo />
        </Link>
        <nav aria-label="Navegação principal">
          <Link className="income-nav-link" href={homeHref}>
            <House size={20} />
            Início
          </Link>
          <span
            className="income-nav-link income-nav-current"
            aria-current="page"
          >
            <ChartBar size={20} />
            Receitas
          </span>
          <Link
            className="income-nav-link"
            href={`/composicao-saldo?${new URLSearchParams({ household: state.householdId, period: state.period, currency })}`}
          >
            <Wallet size={20} />
            Contas
          </Link>
        </nav>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <label>
            Residência
            <select
              aria-label="Residência atual"
              value={state.householdId}
              onChange={(e) => state.selectHousehold(e.target.value)}
            >
              {state.households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <section className="income-hero">
          <div>
            <Link href={homeHref} className="balance-back">
              <ArrowLeft size={18} />
              Início
            </Link>
            <h1>Detalhamento de receitas</h1>
            <p>Veja as entradas que compõem suas receitas.</p>
          </div>
          <Image
            src="/images/pipo-income.webp"
            width={700}
            height={350}
            sizes="(max-width: 760px) 130px, 300px"
            alt="Pipo com envelopes, moedas e folhas"
            preload
          />
        </section>
        <div className="income-controls">
          <button
            className="period-trigger"
            aria-haspopup="dialog"
            onClick={() => setPicker(true)}
          >
            {periodLabel(state.period)} ▾
          </button>
          <label>
            <span className="sr-only">Moeda</span>
            <select
              value={currency}
              aria-label="Moeda"
              onChange={(e) => setCurrency(e.target.value)}
            >
              {data.currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
        </div>
        {picker ? (
          <PeriodPicker
            value={state.period}
            onClose={() => setPicker(false)}
            onApply={(value) => {
              setPicker(false);
              state.selectPeriod(value);
            }}
          />
        ) : null}
        <IncomeResults
          key={`${state.householdId}:${state.period}:${currency}`}
          household={state.householdId}
          period={state.period}
          currency={currency}
          expectedTotal={
            data.summaries.find((row) => row.currency === currency)!.income
          }
          refreshHome={state.retry}
        />
      </div>
    </main>
  );
}
function IncomeResults({
  household,
  period,
  currency,
  expectedTotal,
  refreshHome,
}: {
  household: string;
  period: string;
  currency: string;
  expectedTotal: number;
  refreshHome: () => void;
}) {
  const state = useIncomeDetails(household, period, currency),
    [selected, setSelected] = useState<IncomeItem | null>(null);
  if (state.status !== "ready" || !state.data)
    return (
      <section className="dashboard-panel">
        <p role="status">
          {state.status === "loading"
            ? "Carregando lançamentos de receita…"
            : state.notice}
        </p>
        {state.status === "error" ? (
          <button className="primary" onClick={state.retry}>
            Tentar novamente
          </button>
        ) : null}
      </section>
    );
  const data = state.data,
    complete = data.items.length === data.totalCount;
  const mismatch =
    data.total !== expectedTotal ||
    (complete &&
      data.items.reduce((sum, item) => sum + BigInt(item.amount), BigInt(0)) !==
        BigInt(data.total));
  return (
    <>
      <section className="dashboard-panel income-total">
        <ChartBar size={36} weight="duotone" aria-hidden="true" />
        <div>
          <p>Total de receitas</p>
          <strong>{money(data.total, currency)}</strong>
          <p>
            {data.totalCount}{" "}
            {data.totalCount === 1 ? "lançamento" : "lançamentos"} no período
          </p>
        </div>
      </section>
      {!data.isReconciled || mismatch ? (
        <p role="alert" className="dashboard-reconciliation">
          Os dados mudaram ou há divergência na conciliação. Atualize antes de
          usar estes totais.{" "}
          <button className="dashboard-text" onClick={refreshHome}>
            Atualizar
          </button>
        </p>
      ) : null}
      <section aria-labelledby="income-entries-title">
        <div className="dashboard-section-heading">
          <h2 id="income-entries-title">Lançamentos de receita</h2>
          <span className="dashboard-caption">
            {data.items.length} de {data.totalCount}
          </span>
        </div>
        {data.totalCount === 0 ? (
          <p>Nenhuma receita registrada neste período e moeda.</p>
        ) : (
          <div className="income-table-wrap">
            <table className="income-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Categoria / Origem</th>
                  <th>Conta</th>
                  <th>Valor</th>
                  <th>
                    <span className="sr-only">Detalhes</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      {row.isReversal
                        ? "Estorno de receita"
                        : row.description || "Receita"}
                    </th>
                    <td>{row.date.split("-").reverse().join("/")}</td>
                    <td>
                      {[row.category, row.source].filter(Boolean).join(" · ") ||
                        "Sem classificação"}
                    </td>
                    <td>{row.accountName}</td>
                    <td
                      className={
                        row.amount < 0
                          ? "dashboard-negative"
                          : "dashboard-positive"
                      }
                    >
                      {row.amount > 0 ? "+ " : ""}
                      {money(row.amount, currency)}
                    </td>
                    <td>
                      <button
                        aria-label={`Ver detalhes de ${row.isReversal ? "estorno" : row.description || "receita"}`}
                        onClick={() => setSelected(row)}
                      >
                        Detalhes ›
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {state.notice ? (
          <p role="alert">
            {state.notice}{" "}
            <button className="dashboard-text" onClick={state.retry}>
              Atualizar lista
            </button>
          </p>
        ) : null}
        {!complete ? (
          <button
            className="income-more"
            disabled={state.loadingMore}
            onClick={state.loadMore}
          >
            {state.loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        ) : null}
        {selected ? (
          <div
            className="dashboard-panel income-detail"
            role="region"
            aria-label="Detalhes do lançamento"
          >
            <button className="balance-back" onClick={() => setSelected(null)}>
              Fechar detalhes
            </button>
            <h3>
              {selected.isReversal
                ? "Estorno de receita"
                : selected.description || "Receita"}
            </h3>
            <dl>
              <div>
                <dt>Data</dt>
                <dd>{selected.date.split("-").reverse().join("/")}</dd>
              </div>
              <div>
                <dt>Conta</dt>
                <dd>{selected.accountName}</dd>
              </div>
              <div>
                <dt>Categoria / origem</dt>
                <dd>
                  {[selected.category, selected.source]
                    .filter(Boolean)
                    .join(" · ") || "Sem classificação"}
                </dd>
              </div>
              <div>
                <dt>Valor</dt>
                <dd>{money(selected.amount, currency)}</dd>
              </div>
            </dl>
            {selected.isReversal ? (
              <p>Este estorno reduz as receitas do período.</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
