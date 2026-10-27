"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  House,
  Receipt,
  Wallet,
  ChartPie,
  Target,
  Gear,
  ArrowUp,
  ArrowDown,
  ArrowsLeftRight,
  Plus,
  Plant,
} from "@phosphor-icons/react";
import { money, periodLabel } from "@inout/finance";
import { PeriodPicker } from "./period-picker";
import { useFinancialHome } from "../lib/finance/use-financial-home";

const icons = [House, Receipt, Wallet, ChartPie, Target, Gear];
export function DashboardScreen() {
  const p = useSearchParams();
  const household = p.get("household") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "";
  return (
    <DashboardView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function DashboardView({
  initialCurrency,
  ...options
}: {
  initialHouseholdId: string;
  initialPeriod: string;
  initialCurrency: string;
}) {
  const state = useFinancialHome(options);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [chosenCurrency, setCurrency] = useState(initialCurrency);
  const [notice, setNotice] = useState("");
  const navigation = [
    "Início",
    "Lançamentos",
    "Contas",
    "Categorias",
    "Metas",
    "Configurações",
  ];
  if (
    state.status !== "ready" ||
    !state.data ||
    !state.data.currencies.length
  ) {
    const empty =
      state.status === "empty" ||
      (state.status === "ready" && !state.data?.currencies.length);
    return (
      <main className="financial-state">
        <h1>Seu ninho em equilíbrio</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando suas finanças…"
            : empty
              ? state.households.length
                ? "Esta residência ainda não possui contas financeiras."
                : "Você ainda não participa de uma residência."
              : state.notice}
        </p>
        {state.status !== "loading" ? (
          <button className="primary" onClick={state.retry}>
            Atualizar residências
          </button>
        ) : null}
        <button
          className="period-trigger"
          onClick={() => setPeriodOpen(true)}
          aria-haspopup="dialog"
        >
          {periodLabel(state.period)}
        </button>
        {periodOpen ? (
          <PeriodPicker
            value={state.period}
            onClose={() => setPeriodOpen(false)}
            onApply={(value) => {
              setPeriodOpen(false);
              state.selectPeriod(value);
            }}
          />
        ) : null}
        <Link href="/comecar">Escolher como começar</Link>
        {state.households.length > 1 ? (
          <label>
            Residência
            <select
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
        ) : null}
        <Link href="/entrar">Ir para entrar</Link>
      </main>
    );
  }
  const data = state.data;
  const currencies = data.currencies;
  const currency = currencies.includes(chosenCurrency)
    ? chosenCurrency
    : currencies[0];
  const current = data.summaries.find((row) => row.currency === currency)!;
  const chart = data.history.map((row) => ({
    period: row.period,
    ...(row.summaries.find((value) => value.currency === currency) ?? {
      income: 0,
      expense: 0,
    }),
  }));
  const maximum = Math.max(
    1,
    ...chart.flatMap((row) => [row.income, row.expense]),
  );
  const hasNegative = chart.some((row) => row.income < 0 || row.expense < 0);
  const rows = data.transactions.slice(0, 4);
  const household = state.households.find((h) => h.id === state.householdId)!;
  function unavailable(label: string) {
    setNotice(`${label}: esta área ainda não está disponível no aplicativo.`);
  }
  return (
    <main className="dashboard">
      <aside className="dashboard-sidebar">
        <Link href="/inicio" className="dashboard-brand">
          <Plant size={32} weight="duotone" />
          Ninho
        </Link>
        <nav aria-label="Navegação principal">
          {navigation.map((label, index) => {
            const Icon = icons[index];
            return (
              <button
                key={label}
                type="button"
                aria-current={index === 0 ? "page" : undefined}
                onClick={() =>
                  index === 0 ? setNotice("") : unavailable(label)
                }
              >
                <Icon size={20} />
                {label}
              </button>
            );
          })}
        </nav>
        <p className="dashboard-motto">
          Mais vida boa
          <br />
          para o nosso amanhã. <span>♥</span>
        </p>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <label>
            <House size={18} />
            <span className="sr-only">Residência atual</span>
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
          <Link
            href="/comecar"
            className="dashboard-profile"
            aria-label="Escolher residência"
          >
            <House size={20} />
          </Link>
        </header>
        <section className="dashboard-hero" aria-labelledby="dashboard-title">
          <div>
            <h1 id="dashboard-title">Seu ninho em equilíbrio</h1>
            <p>Organize hoje para um amanhã mais tranquilo.</p>
          </div>
          <Image
            src="/images/pipo-dashboard-hero.webp"
            width={600}
            height={300}
            alt="Pipo sorrindo entre folhas e flores"
            preload
            sizes="(max-width: 760px) 140px, 220px"
          />
          <button
            className="dashboard-period period-trigger"
            onClick={() => setPeriodOpen(true)}
            aria-haspopup="dialog"
          >
            {periodLabel(state.period)} ▾
          </button>
        </section>
        {periodOpen ? (
          <PeriodPicker
            value={state.period}
            onClose={() => setPeriodOpen(false)}
            onApply={(value) => {
              setPeriodOpen(false);
              state.selectPeriod(value);
            }}
          />
        ) : null}
        <p className="dashboard-caption">
          {household.name} · {periodLabel(state.period)}
        </p>
        {!data.isReconciled ? (
          <p role="alert" className="dashboard-reconciliation">
            O backend identificou uma divergência na conciliação dos registros.
            Confira os lançamentos antes de usar estes totais.
          </p>
        ) : null}
        <section aria-labelledby="balances-title">
          <h2 id="balances-title">Saldos por moeda</h2>
          <div className="dashboard-balances">
            {currencies.map((code) => (
              <article key={code} className="dashboard-balance">
                <span className="dashboard-flag" aria-hidden="true">
                  {code === "BRL" ? "🇧🇷" : code === "USD" ? "🇺🇸" : "💱"}
                </span>
                <div>
                  <p>
                    {code === "BRL"
                      ? "Real brasileiro"
                      : code === "USD"
                        ? "Dólar americano"
                        : code}{" "}
                    · {code}
                  </p>
                  <strong>
                    {money(
                      data.summaries.find((row) => row.currency === code)!
                        .balance,
                      code,
                    )}
                  </strong>
                </div>
                <Wallet size={40} weight="duotone" aria-hidden="true" />
                <Link
                  className="balance-card-link"
                  href={`/composicao-saldo?${new URLSearchParams({ household: state.householdId, period: state.period, currency: code })}`}
                >
                  Ver composição ›
                </Link>
              </article>
            ))}
          </div>
          <p className="dashboard-caption">
            Saldos até {data.periodEnd.split("-").reverse().join("/")}, sem
            conversão entre moedas.
          </p>
        </section>
        <section aria-labelledby="summary-title">
          <div className="dashboard-section-heading">
            <h2 id="summary-title">Resumo do período</h2>
            <div
              className="dashboard-currencies"
              role="group"
              aria-label="Moeda do resumo"
            >
              {currencies.map((code) => (
                <button
                  key={code}
                  aria-pressed={currency === code}
                  onClick={() => setCurrency(code)}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
          <div className="dashboard-summary">
            {[
              {
                label: "Receitas",
                value: current.income,
                icon: ArrowUp,
                kind: "income",
              },
              {
                label: "Despesas",
                value: current.expense,
                icon: ArrowDown,
                kind: "expense",
              },
              {
                label: "Resultado",
                value: current.result,
                icon: Plus,
                kind: "result",
              },
            ].map((item) => (
              <article
                key={item.label}
                className={`dashboard-stat ${item.kind}`}
              >
                <item.icon size={25} aria-hidden="true" />
                <div>
                  <p>{item.label}</p>
                  <strong>
                    {item.kind === "result" && item.value >= 0 ? "+ " : ""}
                    {money(item.value, currency)}
                  </strong>
                  {item.label === "Receitas" ||
                  item.label === "Despesas" ||
                  item.label === "Resultado" ? (
                    <Link
                      className="income-card-link"
                      href={`/${item.label === "Receitas" ? "receitas" : item.label === "Despesas" ? "despesas" : "resultado"}?${new URLSearchParams({ household: state.householdId, period: state.period, currency })}`}
                    >
                      Ver {item.label.toLowerCase()} ›
                    </Link>
                  ) : null}
                  {item.label === "Despesas" ? (
                    <Link
                      className="income-card-link"
                      href={`/resumo-categorias?${new URLSearchParams({ household: state.householdId, period: state.period, currency })}`}
                    >
                      Ver por categoria ›
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <p className="dashboard-caption">
            Receitas menos despesas no período. Transferências não entram no
            resultado.
          </p>
        </section>
        <div className="dashboard-detail-grid">
          <section className="dashboard-panel" aria-labelledby="chart-title">
            <div className="dashboard-section-heading">
              <h2 id="chart-title">Receitas x Despesas</h2>
              <span className="dashboard-legend">
                <i />
                Receitas <i />
                Despesas
              </span>
            </div>
            {hasNegative ? (
              <p>
                Há ajustes negativos no histórico. Consulte os valores abaixo.
              </p>
            ) : (
              <div
                className="dashboard-chart"
                role="img"
                aria-label={`Receitas e despesas em ${currency}, ${state.period.includes("/") ? `intervalo de ${periodLabel(state.period)}` : `de ${periodLabel(chart[0].period)} a ${periodLabel(state.period)}`}. Valores disponíveis na tabela abaixo.`}
              >
                {chart.map((row, index) => (
                  <div key={index} className="dashboard-chart-column">
                    <div className="dashboard-bars">
                      <span
                        style={{ height: `${(row.income / maximum) * 100}%` }}
                      />
                      <span
                        style={{ height: `${(row.expense / maximum) * 100}%` }}
                      />
                    </div>
                    <span>{periodLabel(row.period)}</span>
                  </div>
                ))}
              </div>
            )}
            <details
              className="dashboard-chart-data"
              open={hasNegative || undefined}
            >
              <summary>Ver valores do gráfico</summary>
              <table>
                <caption>Valores em {currency}</caption>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Receitas</th>
                    <th>Despesas</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.map((row, index) => (
                    <tr key={index}>
                      <th>{periodLabel(row.period)}</th>
                      <td>{money(row.income, currency)}</td>
                      <td>{money(row.expense, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
          <section
            className="dashboard-panel"
            aria-labelledby="transactions-title"
          >
            <div className="dashboard-section-heading">
              <h2 id="transactions-title">Últimos lançamentos</h2>
              <button
                className="dashboard-text"
                onClick={() => unavailable("Lançamentos")}
              >
                Ver todos
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="dashboard-caption">Nenhum lançamento no período.</p>
            ) : null}
            <ul className="dashboard-transactions">
              {rows.map((row) => (
                <li key={row.id}>
                  <span
                    className={`dashboard-transaction-icon ${row.cents > 0 ? "income" : "expense"}`}
                  >
                    {row.kind === "transfer" ? (
                      <ArrowsLeftRight size={19} />
                    ) : row.cents > 0 ? (
                      <ArrowUp size={19} />
                    ) : (
                      <Receipt size={19} />
                    )}
                  </span>
                  <div>
                    <strong>{row.name}</strong>
                    <small>{row.category}</small>
                  </div>
                  <time dateTime={row.date}>
                    {row.date.split("-").reverse().join("/")}
                  </time>
                  <span
                    className={
                      row.cents > 0
                        ? "dashboard-positive"
                        : "dashboard-negative"
                    }
                  >
                    {row.cents > 0 ? "+ " : "− "}
                    {money(Math.abs(row.cents), row.currency)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="dashboard-caption">
              Últimos registros do período, na moeda de cada conta.
              Transferências podem ter um registro por conta.
            </p>
          </section>
        </div>
        <section aria-labelledby="actions-title">
          <h2 id="actions-title">Ações rápidas</h2>
          <div className="dashboard-actions">
            {["Registrar entrada", "Registrar saída", "Transferir"].map(
              (label, index) => (
                <button
                  key={label}
                  className={index === 1 ? "expense" : "income"}
                  onClick={() => unavailable(label)}
                >
                  {index === 2 ? (
                    <ArrowsLeftRight size={22} />
                  ) : (
                    <Plus size={22} />
                  )}
                  {label}
                </button>
              ),
            )}
          </div>
        </section>
        <p role="status" className="dashboard-notice">
          {notice}
        </p>
        <nav className="dashboard-bottom-nav" aria-label="Navegação mobile">
          {["Início", "Lançamentos", "Contas", "Mais"].map((label, index) => {
            const Icon = icons[index];
            return (
              <button
                key={label}
                aria-current={index === 0 ? "page" : undefined}
                onClick={() =>
                  index === 0 ? setNotice("") : unavailable(label)
                }
              >
                <Icon size={23} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
