"use client";
import { BrandLogo } from "../ui/brand-logo";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { House, Wallet, ChartBar, ArrowLeft } from "@phosphor-icons/react";
import {
  money,
  periodLabel,
  recentResultEntries,
  type Summary,
} from "@inout/finance";
import { useFinancialHome } from "../../lib/finance/use-financial-home";
import { useExpenseDetails } from "../../lib/finance/use-expense-details";
import { useIncomeDetails } from "../../lib/finance/use-income-details";
import { PeriodPicker } from "../financial/selectors/period-picker";
export function ResultScreen() {
  const p = useSearchParams(),
    household = p.get("household") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "";
  return (
    <ResultView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function ResultView({
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
        <h1>Detalhamento do resultado</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando resultado…"
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
            Resultado
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
            <h1>Detalhamento do resultado</h1>
            <p>Entenda como suas receitas e despesas formam o resultado.</p>
          </div>
          <Image
            src="/images/pipo-result.webp"
            width={700}
            height={350}
            sizes="(max-width: 760px) 130px, 300px"
            alt="Pipo ao lado de uma balança e de um caderno"
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
        <ResultDetails
          key={`${state.householdId}:${state.period}:${currency}`}
          household={state.householdId}
          period={state.period}
          currency={currency}
          summary={data.summaries.find((row) => row.currency === currency)!}
          reconciled={data.isReconciled}
          refreshHome={state.retry}
        />
      </div>
    </main>
  );
}

function ResultDetails({
  household,
  period,
  currency,
  summary,
  reconciled,
  refreshHome,
}: {
  household: string;
  period: string;
  currency: string;
  summary: Summary;
  reconciled: boolean;
  refreshHome: () => void;
}) {
  const income = useIncomeDetails(household, period, currency);
  const expense = useExpenseDetails(household, period, currency);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const query = new URLSearchParams({ household, period, currency }).toString();
  const incomeHref = `/receitas?${query}`,
    expenseHref = `/despesas?${query}`;
  const mismatch =
    !reconciled ||
    BigInt(summary.income) - BigInt(summary.expense) !==
      BigInt(summary.result) ||
    (income.data !== null &&
      (!income.data.isReconciled || income.data.total !== summary.income)) ||
    (expense.data !== null &&
      (!expense.data.isReconciled || expense.data.total !== summary.expense));
  const entries = recentResultEntries(
    income.data?.items ?? [],
    expense.data?.items ?? [],
    filter,
  );
  const busy = income.status === "loading" || expense.status === "loading";
  const failed = income.status === "error" || expense.status === "error";
  return (
    <>
      <div className="result-cards">
        <article>
          <p>Receitas</p>
          <strong>{money(summary.income, currency)}</strong>
          <Link href={incomeHref}>Ver receitas →</Link>
        </article>
        <span aria-hidden="true">−</span>
        <article className="result-expense">
          <p>Despesas</p>
          <strong>{money(summary.expense, currency)}</strong>
          <Link href={expenseHref}>Ver despesas →</Link>
        </article>
        <span aria-hidden="true">=</span>
        <article>
          <p>Resultado do período</p>
          <strong>
            {summary.result > 0 ? "+ " : ""}
            {money(summary.result, currency)}
          </strong>
          <small>Receitas menos despesas no período.</small>
        </article>
      </div>
      {mismatch ? (
        <p role="alert" className="dashboard-reconciliation">
          Os dados mudaram ou há divergência na conciliação.{" "}
          <button
            onClick={() => {
              refreshHome();
              income.retry();
              expense.retry();
            }}
          >
            Atualizar
          </button>
        </p>
      ) : null}
      <section
        className="result-entries dashboard-panel"
        aria-labelledby="result-entries-title"
      >
        <h2 id="result-entries-title">Lançamentos recentes</h2>
        <p>Transferências entre contas não entram no resultado.</p>
        <div className="result-filters" aria-label="Filtrar lançamentos">
          {(
            [
              ["all", "Todos"],
              ["income", "Receitas"],
              ["expense", "Despesas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {busy ? (
          <p role="status">Carregando lançamentos…</p>
        ) : failed ? (
          <p role="alert">
            Não foi possível carregar os lançamentos.{" "}
            <button
              onClick={() => {
                income.retry();
                expense.retry();
              }}
            >
              Tentar novamente
            </button>
          </p>
        ) : entries.length === 0 ? (
          <p>Nenhum lançamento neste período e moeda.</p>
        ) : (
          <div className="income-table-wrap">
            <table className="income-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th>
                    <span className="sr-only">Lista de lançamentos</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => {
                  const amount =
                    row.flow === "income" ? row.amount : -row.amount;
                  const title = row.isReversal
                    ? `Estorno de ${row.flow === "income" ? "receita" : "despesa"}`
                    : row.description ||
                      (row.flow === "income" ? "Receita" : "Despesa");
                  return (
                    <tr key={`${row.flow}:${row.id}`}>
                      <th scope="row">{title}</th>
                      <td>{row.date.split("-").reverse().join("/")}</td>
                      <td>
                        {row.category || row.source || "Sem classificação"}
                      </td>
                      <td
                        className={
                          amount < 0
                            ? "dashboard-negative"
                            : "dashboard-positive"
                        }
                      >
                        {amount > 0 ? "+ " : ""}
                        {money(amount, currency)}
                      </td>
                      <td>
                        <Link
                          href={
                            row.flow === "income" ? incomeHref : expenseHref
                          }
                          aria-label={`Ver lançamentos: ${title}`}
                        >
                          Ver lista ›
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="result-links">
          <Link href={incomeHref}>Todos os lançamentos de receita →</Link>
          <Link href={expenseHref}>Todos os lançamentos de despesa →</Link>
        </div>
      </section>
    </>
  );
}
