"use client";
import { BrandLogo } from "../ui/brand-logo";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { House, Wallet, ChartBar, ArrowLeft } from "@phosphor-icons/react";
import { money, periodLabel, type CategoryGroup } from "@inout/finance";
import { useFinancialHome } from "../../lib/finance/use-financial-home";
import { useExpenseDetails } from "../../lib/finance/use-expense-details";
import { useCategorySummary } from "../../lib/finance/use-category-summary";
import { PeriodPicker } from "../financial/selectors/period-picker";
export function CategoryScreen() {
  const p = useSearchParams(),
    household = p.get("household") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "";
  return (
    <CategoryView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function CategoryView({
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
        <h1>Resumo por categoria</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando categorias…"
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
            Categorias
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
            <h1>Resumo por categoria</h1>
            <p>Descubra como suas despesas se distribuem.</p>
          </div>
          <Image
            src="/images/pipo-category.webp"
            width={700}
            height={350}
            sizes="(max-width: 760px) 130px, 300px"
            alt="Pipo organizando cestas de itens domésticos"
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
        <CategoryDetails
          key={`${state.householdId}:${state.period}:${currency}`}
          household={state.householdId}
          period={state.period}
          currency={currency}
          expectedTotal={
            data.summaries.find((row) => row.currency === currency)!.expense
          }
          refreshHome={state.retry}
        />
      </div>
    </main>
  );
}

function CategoryDetails({
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
  const state = useCategorySummary(household, period, currency),
    expenses = useExpenseDetails(household, period, currency);
  const [selected, setSelected] = useState<CategoryGroup | undefined>(
    undefined,
  );
  const [open, setOpen] = useState<string | null>(null);
  if (state.loading) return <p role="status">Carregando categorias…</p>;
  if (!state.data)
    return (
      <p role="alert">
        {state.error} <button onClick={state.retry}>Tentar novamente</button>
      </p>
    );
  const data = state.data,
    mismatch =
      !data.isReconciled ||
      data.total !== expectedTotal ||
      (expenses.data !== null &&
        (!expenses.data.isReconciled || expenses.data.total !== data.total));
  const canChart = data.total > 0 && data.groups.every((g) => g.amount >= 0);
  const colors = [
    "#365e48",
    "#ce7650",
    "#d49a39",
    "#779965",
    "#a77687",
    "#6d9292",
  ];
  let position = 0;
  const stops = canChart
    ? data.groups
        .map((g, i) => {
          const start = position;
          position += (g.amount / data.total) * 100;
          return `${colors[i % colors.length]} ${start}% ${position}%`;
        })
        .join(",")
    : "";
  const ids = new Set<string | null>();
  const visit = (group: CategoryGroup) => {
    ids.add(group.id);
    group.children.forEach(visit);
  };
  if (selected) visit(selected);
  const rows = selected
    ? (expenses.data?.items ?? []).filter((row) => ids.has(row.categoryId))
    : [];
  const complete =
    expenses.data && expenses.data.items.length === expenses.data.totalCount;
  return (
    <>
      {mismatch ? (
        <p role="alert" className="dashboard-reconciliation">
          Os dados mudaram ou há divergência na conciliação.{" "}
          <button
            onClick={() => {
              state.retry();
              expenses.retry();
              refreshHome();
            }}
          >
            Atualizar
          </button>
        </p>
      ) : null}
      <div className="category-layout">
        <section className="dashboard-panel category-overview">
          <p>Despesas no período</p>
          <strong>{money(data.total, currency)}</strong>
          {canChart && data.groups.length ? (
            <div
              className="category-donut"
              style={{ background: `conic-gradient(${stops})` }}
              aria-hidden="true"
            >
              <div>
                <b>{money(data.total, currency)}</b>
                <small>Total de despesas</small>
              </div>
            </div>
          ) : (
            <p>
              {data.total === 0
                ? "Sem despesas líquidas no período."
                : "Gráfico indisponível para valores negativos."}
            </p>
          )}
          <ul className="category-legend">
            {data.groups.map((g, i) => (
              <li key={g.id ?? "none"}>
                <span style={{ background: colors[i % colors.length] }} />
                <b>{g.name}</b>
                <span>{money(g.amount, currency)}</span>
                {canChart ? (
                  <small>{((g.amount / data.total) * 100).toFixed(1)}%</small>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <section className="category-groups" aria-label="Categorias">
          <p>
            Selecione uma categoria ou subcategoria para ver os lançamentos.
          </p>
          {data.groups.length === 0 ? (
            <p>Nenhuma despesa líquida por categoria neste período e moeda.</p>
          ) : (
            data.groups.map((group) => (
              <div
                className="dashboard-panel category-group"
                key={group.id ?? "none"}
              >
                <button
                  aria-expanded={open === (group.id ?? "none")}
                  onClick={() =>
                    setOpen(
                      open === (group.id ?? "none")
                        ? null
                        : (group.id ?? "none"),
                    )
                  }
                >
                  <b>{group.name}</b>
                  <span>
                    {money(group.amount, currency)}{" "}
                    {canChart
                      ? `· ${((group.amount / data.total) * 100).toFixed(1)}%`
                      : ""}{" "}
                    ▾
                  </span>
                </button>
                {open === (group.id ?? "none") ? (
                  <>
                    <button
                      className="category-sub"
                      onClick={() => setSelected(group)}
                    >
                      Ver lançamentos de {group.name} ›
                    </button>
                    {group.children.map((child) => (
                      <button
                        className="category-sub"
                        key={child.id}
                        onClick={() => setSelected(child)}
                      >
                        {child.name}{" "}
                        <span>{money(child.amount, currency)} ›</span>
                      </button>
                    ))}
                  </>
                ) : null}
              </div>
            ))
          )}
        </section>
      </div>
      {selected ? (
        <section className="dashboard-panel category-drill">
          <h2>Lançamentos: {selected.name}</h2>
          <button onClick={() => setSelected(undefined)}>Fechar</button>
          {expenses.status === "loading" ? (
            <p role="status">Carregando lançamentos…</p>
          ) : expenses.status === "error" ? (
            <p role="alert">
              {expenses.notice}{" "}
              <button onClick={expenses.retry}>Tentar novamente</button>
            </p>
          ) : (
            <>
              {rows.length ? (
                <ul>
                  {rows.map((row) => (
                    <li key={row.id}>
                      {row.isReversal
                        ? "Estorno de despesa"
                        : row.description || "Despesa"}{" "}
                      · {row.date.split("-").reverse().join("/")} ·{" "}
                      {money(-row.amount, currency)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {complete
                    ? "Nenhum lançamento nesta categoria."
                    : "Nenhum lançamento desta categoria nas páginas carregadas."}
                </p>
              )}
              {expenses.notice ? (
                <p role="alert">
                  {expenses.notice}{" "}
                  <button onClick={expenses.retry}>Atualizar lista</button>
                </p>
              ) : null}
              {!complete ? (
                <button
                  disabled={expenses.loadingMore}
                  onClick={expenses.loadMore}
                >
                  {expenses.loadingMore
                    ? "Carregando…"
                    : "Carregar mais lançamentos"}
                </button>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
