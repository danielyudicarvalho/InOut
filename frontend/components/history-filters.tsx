"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  historyDraft,
  applyHistoryDraft,
  parsePeriod,
  financeMessage,
  type HistoryFilters,
  type HistoryOptions,
} from "@inout/finance";
import { useHistoryOptions } from "../lib/finance/use-history-options";
export function HistoryFiltersPanel({
  household,
  period,
  filters,
  onApply,
  onClose,
}: {
  household: string;
  period: string;
  filters: HistoryFilters;
  onApply: (period: string, filters: HistoryFilters) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    options = useHistoryOptions(household);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="history-filter-dialog"
      aria-labelledby="filter-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="history-filter-sheet">
        <button
          className="filter-close"
          aria-label="Fechar filtros"
          onClick={onClose}
        >
          ×
        </button>
        <Image
          src="/images/pipo-filters.webp"
          alt=""
          width={360}
          height={180}
          className="filter-art"
        />
        <h2 id="filter-title">Busca e filtros</h2>
        <p>Encontre as movimentações do seu lar.</p>
        {options.data ? (
          <FilterForm
            catalog={options.data}
            period={period}
            filters={filters}
            onApply={onApply}
          />
        ) : (
          <div role="status">
            {options.error || "Carregando contas e categorias…"}
            {options.error && (
              <button onClick={options.retry}>Tentar novamente</button>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
function FilterForm({
  catalog,
  period,
  filters,
  onApply,
}: {
  catalog: HistoryOptions;
  period: string;
  filters: HistoryFilters;
  onApply: (period: string, filters: HistoryFilters) => void;
}) {
  const [draft, setDraft] = useState(() =>
      historyDraft(period, filters, catalog),
    ),
    [error, setError] = useState("");
  const categories = catalog.categories.filter(
    (c) =>
      !c.parentId &&
      (!["income", "expense"].includes(draft.kind ?? "") ||
        c.flow === draft.kind),
  );
  const children = catalog.categories.filter(
    (c) => c.parentId === draft.parentId,
  );
  const select = (name: string, value: string) =>
    setDraft({ ...draft, [name]: value });
  const badges = [
    draft.kind && {
      label: (
        {
          income: "Entrada",
          expense: "Saída",
          transfer: "Transferência",
          reversal: "Estorno",
          openingbalance: "Saldo inicial",
        } as Record<string, string>
      )[draft.kind],
      remove: () => setDraft({ ...draft, kind: "", incomeSourceId: "" }),
    },
    draft.accountId && {
      label:
        catalog.accounts.find((a) => a.id === draft.accountId)?.name ?? "Conta",
      remove: () => select("accountId", ""),
    },
    draft.parentId && {
      label:
        catalog.categories.find((c) => c.id === draft.parentId)?.name ??
        "Categoria",
      remove: () => setDraft({ ...draft, parentId: "", subcategoryId: "" }),
    },
    draft.subcategoryId && {
      label:
        catalog.categories.find((c) => c.id === draft.subcategoryId)?.name ??
        "Subcategoria",
      remove: () => select("subcategoryId", ""),
    },
    draft.incomeSourceId && {
      label:
        catalog.sources.find((s) => s.id === draft.incomeSourceId)?.name ??
        "Fonte",
      remove: () => select("incomeSourceId", ""),
    },
  ].filter(Boolean) as { label: string; remove: () => void }[];
  return (
    <form
      className="history-filter-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const next = applyHistoryDraft(draft);
          onApply(next.period, next.filters);
        } catch (e) {
          setError(financeMessage(e));
        }
      }}
    >
      <label>
        Buscar por texto
        <input
          value={draft.search ?? ""}
          onChange={(e) => select("search", e.target.value)}
          placeholder="Descrição do lançamento"
          maxLength={500}
        />
      </label>
      <fieldset>
        <legend>Período</legend>
        <div className="filter-dates">
          <label>
            Data inicial
            <input
              type="date"
              required
              value={draft.from}
              onChange={(e) => select("from", e.target.value)}
            />
          </label>
          <label>
            Data final
            <input
              type="date"
              required
              value={draft.to}
              onChange={(e) => select("to", e.target.value)}
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Tipo</legend>
        <div className="filter-chips">
          {[
            ["", "Todos"],
            ["income", "Entrada"],
            ["expense", "Saída"],
            ["transfer", "Transferência"],
            ["reversal", "Estorno"],
            ["openingbalance", "Saldo inicial"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={(draft.kind ?? "") === value}
              onClick={() =>
                setDraft({
                  ...draft,
                  kind: value,
                  parentId: "",
                  subcategoryId: "",
                  incomeSourceId:
                    value === "income" ? draft.incomeSourceId : "",
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Conta
        <select
          value={draft.accountId ?? ""}
          onChange={(e) => select("accountId", e.target.value)}
        >
          <option value="">Todas as contas</option>
          {catalog.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency}
            </option>
          ))}
        </select>
      </label>
      <label>
        Categoria
        <select
          value={draft.parentId}
          onChange={(e) =>
            setDraft({ ...draft, parentId: e.target.value, subcategoryId: "" })
          }
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Subcategoria
        <select
          disabled={!draft.parentId}
          value={draft.subcategoryId}
          onChange={(e) => select("subcategoryId", e.target.value)}
        >
          <option value="">Todas da categoria</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fonte de renda
        <select
          disabled={draft.kind !== "income"}
          value={draft.incomeSourceId ?? ""}
          onChange={(e) => select("incomeSourceId", e.target.value)}
        >
          <option value="">
            {draft.kind === "income"
              ? "Todas as fontes"
              : "Disponível para entradas"}
          </option>
          {catalog.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {draft.kind !== "income" && (
        <small>Selecione Entrada para filtrar por fonte de renda.</small>
      )}
      <div>
        <strong>Filtros selecionados</strong>
        <div className="filter-chips">
          {badges.map((b, i) => (
            <button
              key={i}
              type="button"
              onClick={b.remove}
              aria-label={`Remover ${b.label}`}
            >
              {b.label} ×
            </button>
          ))}
          {!badges.length && <small>Nenhum filtro adicional.</small>}
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <footer>
        <button
          type="button"
          onClick={() => {
            const b = parsePeriod(period);
            setDraft({
              from: b.from,
              to: b.to,
              parentId: "",
              subcategoryId: "",
            });
            setError("");
          }}
        >
          Limpar filtros
        </button>
        <button className="primary" type="submit">
          Aplicar filtros
        </button>
      </footer>
    </form>
  );
}
