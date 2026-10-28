"use client";
import { HistoryFiltersPanel } from "./history-filters";
import { BrandLogo } from "./brand-logo";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  money,
  displayDate,
  periodLabel,
  historyKind,
  type HistoryFilters,
} from "@inout/finance";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import { useLedgerHistory } from "../lib/finance/use-ledger-history";
import { PeriodPicker } from "./period-picker";
import { NewRecordPicker } from "./new-record-picker";
export function LedgerHistoryScreen() {
  const p = useSearchParams();
  const home = useFinancialHome({
    initialHouseholdId: p.get("household") ?? "",
    initialPeriod: p.get("period") ?? "",
  });
  const [periodOpen, setPeriodOpen] = useState(false),
    [recordOpen, setRecordOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [filters, setFilters] = useState<HistoryFilters>(() => ({
      transactionId: p.get("transaction") ?? "",
    })),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0);
  const params = new URLSearchParams({
    household: home.householdId,
    period: home.period,
  });
  return (
    <main className="dashboard ledger-page">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href={`/inicio?${params}`}>
          <BrandLogo />
        </Link>
        <nav>
          <Link href={`/inicio?${params}`}>Início</Link>
          <strong aria-current="page">Lançamentos</strong>
          <Link href={`/composicao-saldo?${params}`}>Contas</Link>
        </nav>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <label>
            Residência{" "}
            <select
              value={home.householdId}
              onChange={(e) => {
                home.selectHousehold(e.target.value);
                setFilters({});
                setSearch("");
                setFiltersOpen(false);
                setOffset(0);
              }}
            >
              {home.households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <section className="ledger-content">
          <div className="ledger-hero">
            <div>
              <h1>Histórico de lançamentos</h1>
              <p>Acompanhe as movimentações do seu lar.</p>
            </div>
            <Image
              src="/images/pipo-history.webp"
              alt=""
              width={360}
              height={200}
            />
          </div>
          {filters.transactionId && (
            <Link
              href={`/lancamentos?${params}`}
              onClick={() => {
                setFilters({});
                setOffset(0);
              }}
            >
              Ver histórico completo
            </Link>
          )}
          <div className="ledger-tools">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFilters({ ...filters, search });
                setOffset(0);
              }}
            >
              <input
                aria-label="Buscar pela descrição"
                placeholder="Buscar lançamento…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button>Buscar</button>
            </form>
            <button onClick={() => setPeriodOpen(true)}>
              {periodLabel(home.period)}
            </button>
            <button
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              Filtros {Object.values(filters).filter(Boolean).length ? "•" : ""}
            </button>
            <button
              className="primary"
              onClick={() => setRecordOpen(true)}
              disabled={!home.householdId}
            >
              + Novo registro
            </button>
          </div>
          {home.status === "ready" ? (
            <HistoryRows
              key={`${home.householdId}:${home.period}:${JSON.stringify(filters)}:${offset}`}
              household={home.householdId}
              period={home.period}
              filters={filters}
              offset={offset}
              onPage={setOffset}
            />
          ) : (
            <p role="status">
              {home.status === "loading"
                ? "Carregando residências…"
                : home.notice || "Nenhuma residência disponível."}
            </p>
          )}
        </section>
      </div>
      {filtersOpen && (
        <HistoryFiltersPanel
          key={home.householdId}
          household={home.householdId}
          period={home.period}
          filters={filters}
          onClose={() => setFiltersOpen(false)}
          onApply={(period, next) => {
            home.selectPeriod(period);
            setFilters(next);
            setSearch(next.search ?? "");
            setOffset(0);
            setFiltersOpen(false);
          }}
        />
      )}
      {periodOpen && (
        <PeriodPicker
          value={home.period}
          onClose={() => setPeriodOpen(false)}
          onApply={(value) => {
            home.selectPeriod(value);
            setOffset(0);
            setPeriodOpen(false);
          }}
        />
      )}
      {recordOpen && (
        <NewRecordPicker
          household={home.householdId}
          period={home.period}
          currency={p.get("currency") ?? home.data?.currencies[0] ?? "BRL"}
          onClose={() => setRecordOpen(false)}
        />
      )}
    </main>
  );
}
function HistoryRows({
  household,
  period,
  filters,
  offset,
  onPage,
}: {
  household: string;
  period: string;
  filters: HistoryFilters;
  offset: number;
  onPage: (offset: number) => void;
}) {
  const state = useLedgerHistory(household, period, filters, offset);
  if (state.loading) return <p role="status">Carregando lançamentos…</p>;
  if (state.error)
    return (
      <div role="alert">
        <p>{state.error}</p>
        <button onClick={state.retry}>Tentar novamente</button>
      </div>
    );
  return (
    <>
      <div className="ledger-table">
        <table>
          <thead>
            <tr>
              {[
                "Descrição / Tipo",
                "Data",
                "Conta",
                "Classificação",
                "Valor",
                "Situação / Detalhes",
              ].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.items.map((item, i) => (
              <tr key={`${item.transactionId}:${item.accountId}:${i}`}>
                <td>
                  <Link
                    href={`/lancamento?${new URLSearchParams({ household, period, transaction: item.transactionId })}`}
                  >
                    <strong>{item.description}</strong>
                  </Link>
                  <small>{historyKind(item)}</small>
                </td>
                <td>{displayDate(item.date)}</td>
                <td>{item.accountName}</td>
                <td>
                  {item.category}
                  {item.source ? ` · ${item.source}` : ""}
                </td>
                <td
                  className={
                    item.kind === "transfer"
                      ? "ledger-transfer"
                      : item.amount < 0
                        ? "ledger-out"
                        : "ledger-in"
                  }
                >
                  <span
                    style={{
                      textDecoration:
                        item.status === "reversed" ? "line-through" : "none",
                    }}
                  >
                    {money(item.amount, item.currency)}
                  </span>
                </td>
                <td>
                  <details open={filters.transactionId === item.transactionId}>
                    <summary>
                      <span
                        className={
                          item.status === "reversed"
                            ? "ledger-reversed"
                            : "ledger-posted"
                        }
                      >
                        {item.status === "reversed"
                          ? "Estornado"
                          : item.status === "posted"
                            ? "Registrado"
                            : item.status}
                      </span>
                    </summary>
                    <p>ID: {item.transactionId}</p>
                    <p>Moeda: {item.currency}</p>
                    {item.reversalOf && <p>Estorno de: {item.reversalOf}</p>}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!state.items.length && (
        <p role="status">
          Nenhum lançamento encontrado neste período com estes filtros.
        </p>
      )}
      <footer className="ledger-tools">
        <p>
          {state.items.length} registros nesta página · Página {offset / 50 + 1}
        </p>
        <button
          disabled={offset === 0}
          onClick={() => onPage(Math.max(0, offset - 50))}
        >
          Anterior
        </button>
        <button disabled={!state.hasMore} onClick={() => onPage(offset + 50)}>
          Próxima
        </button>
        <button onClick={state.retry}>Atualizar</button>
      </footer>
      <p className="ledger-help">
        Transferências mostram uma movimentação por conta. Valores na moeda de
        cada conta. A lista pode mudar quando novos registros forem publicados.
      </p>
    </>
  );
}
