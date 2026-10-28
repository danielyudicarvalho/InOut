"use client";
import { BrandLogo } from "./brand-logo";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { House, Wallet, ChartBar, ArrowLeft } from "@phosphor-icons/react";
import { money, periodLabel } from "@inout/finance";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import { useIncomeDetails } from "../lib/finance/use-income-details";
import { PeriodPicker } from "./period-picker";
export function IncomeSourcesScreen() {
  const p = useSearchParams(),
    household = p.get("household") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "";
  return (
    <IncomeSourcesView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function IncomeSourcesView({
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
        <h1>Resumo por fonte de renda</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando fontes de renda…"
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
            Fontes de renda
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
            <h1>Resumo por fonte de renda</h1>
            <p>Veja de onde vêm as receitas do seu lar.</p>
          </div>
          <Image
            src="/images/pipo-income-sources.webp"
            width={700}
            height={350}
            sizes="(max-width: 760px) 130px, 300px"
            alt="Pipo regando plantas com moedas"
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
        <IncomeSourcesResults
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

function IncomeSourcesResults({
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
  const state = useIncomeDetails(household, period, currency);
  const [open, setOpen] = useState<string | null | undefined>(undefined),
    [selectedId, setSelectedId] = useState<string | null>(null);
  if (state.status !== "ready" || !state.data)
    return (
      <section className="dashboard-panel source-state">
        <p role="status">
          {state.status === "loading"
            ? "Carregando fontes de renda…"
            : state.notice}
        </p>
        {state.status === "error" ? (
          <button onClick={state.retry}>Tentar novamente</button>
        ) : null}
      </section>
    );
  const data = state.data,
    sources = data.sources;
  const selected = data.items.find((row) => row.id === selectedId) ?? null;
  if (!sources)
    return (
      <p role="alert">
        Atualize o backend para consultar os totais por fonte de renda.
      </p>
    );
  const positive = data.total > 0 && sources.every((row) => row.amount >= 0),
    complete = data.items.length === data.totalCount;
  const colors = [
    "#075f3c",
    "#80b966",
    "#e7bc44",
    "#6a9a9a",
    "#a57ca1",
    "#d98b5f",
  ];
  let position = 0;
  const stops = positive
    ? sources
        .map((g, i) => {
          const start = position;
          position += (g.amount / data.total) * 100;
          return `${colors[i % colors.length]} ${start}% ${position}%`;
        })
        .join(",")
    : "";
  return (
    <>
      {!data.isReconciled || data.total !== expectedTotal ? (
        <p role="alert" className="dashboard-reconciliation">
          Os dados mudaram ou há divergência na conciliação.{" "}
          <button
            onClick={() => {
              state.retry();
              refreshHome();
            }}
          >
            Atualizar
          </button>
        </p>
      ) : null}
      <div className="source-summary">
        <section className="dashboard-panel source-total">
          <p>Receitas no período</p>
          <strong>{money(data.total, currency)}</strong>
          <p>
            {data.totalCount}{" "}
            {data.totalCount === 1 ? "lançamento" : "lançamentos"} ·{" "}
            {sources.length} {sources.length === 1 ? "fonte" : "fontes"}
          </p>
        </section>
        <section className="dashboard-panel source-distribution">
          <h2>Distribuição das receitas</h2>
          {positive && sources.length ? (
            <div className="source-distribution-body">
              <div
                className="category-donut"
                style={{ background: `conic-gradient(${stops})` }}
                aria-hidden="true"
              >
                <div>
                  <b>{money(data.total, currency)}</b>
                  <small>Total de receitas</small>
                </div>
              </div>
              <ul className="source-legend">
                {sources.map((g, i) => (
                  <li key={g.id ?? "none"}>
                    <span style={{ background: colors[i % colors.length] }} />
                    <div>
                      <b>{g.name}</b>
                      <p>
                        {money(g.amount, currency)} ·{" "}
                        {((g.amount / data.total) * 100).toFixed(1)}%
                      </p>
                      <small>
                        {g.count} {g.count === 1 ? "lançamento" : "lançamentos"}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>
              {sources.length === 0
                ? "Nenhuma receita registrada neste período e moeda."
                : "A distribuição percentual não é exibida para total zero ou valores negativos."}
            </p>
          )}
        </section>
      </div>
      <section className="source-groups">
        <h2>Fontes de renda</h2>
        <p>Selecione uma fonte para consultar seus lançamentos.</p>
        {sources.map((g) => {
          const rows = data.items.filter((row) => row.sourceId === g.id);
          return (
            <article
              className="dashboard-panel source-group"
              key={g.id ?? "none"}
            >
              <button
                className="source-group-toggle"
                aria-expanded={open === g.id}
                onClick={() => setOpen(open === g.id ? undefined : g.id)}
              >
                <div>
                  <b>{g.name}</b>
                  <small>
                    {g.count} {g.count === 1 ? "lançamento" : "lançamentos"}
                  </small>
                </div>
                <div>
                  <b>{money(g.amount, currency)}</b>
                  {positive ? (
                    <small>{((g.amount / data.total) * 100).toFixed(1)}%</small>
                  ) : null}
                </div>
                <span aria-hidden="true">{open === g.id ? "⌃" : "⌄"}</span>
              </button>
              {open === g.id ? (
                <div className="source-source-entries">
                  {rows.map((row) => (
                    <button
                      className="source-entry"
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <div>
                        <b>
                          {row.isReversal
                            ? "Estorno de receita"
                            : row.description || "Receita"}
                        </b>
                        <small>{row.date.split("-").reverse().join("/")}</small>
                      </div>
                      <span
                        className={
                          row.amount < 0
                            ? "dashboard-negative"
                            : "dashboard-positive"
                        }
                      >
                        {row.amount > 0 ? "+ " : ""}
                        {money(row.amount, currency)} ›
                      </span>
                    </button>
                  ))}
                  {rows.length < g.count ? (
                    <>
                      <p>
                        {rows.length} de {g.count} lançamentos desta fonte
                        carregados.
                      </p>
                      {!complete ? (
                        <button
                          disabled={state.loadingMore}
                          onClick={state.loadMore}
                        >
                          {state.loadingMore
                            ? "Carregando…"
                            : "Carregar mais lançamentos"}
                        </button>
                      ) : (
                        <p role="alert">
                          Há divergência na quantidade de lançamentos. Atualize
                          a lista.
                        </p>
                      )}
                    </>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
      {state.notice ? (
        <p role="alert">
          {state.notice} <button onClick={state.retry}>Atualizar lista</button>
        </p>
      ) : null}
      {selected ? (
        <section
          className="dashboard-panel source-details"
          aria-label="Detalhes do lançamento"
        >
          <h2>
            {selected.isReversal
              ? "Estorno de receita"
              : selected.description || "Receita"}
          </h2>
          <dl>
            <dt>Fonte</dt>
            <dd>{selected.source || "Sem fonte de renda"}</dd>
            <dt>Conta</dt>
            <dd>{selected.accountName}</dd>
            <dt>Data</dt>
            <dd>{selected.date.split("-").reverse().join("/")}</dd>
            <dt>Categoria</dt>
            <dd>{selected.category || "Sem classificação"}</dd>
            <dt>Valor</dt>
            <dd>{money(selected.amount, currency)}</dd>
          </dl>
          {selected.isReversal ? (
            <p>Este estorno reduz as receitas do período.</p>
          ) : null}
          <button onClick={() => setSelectedId(null)}>Fechar detalhes</button>
        </section>
      ) : null}
    </>
  );
}
