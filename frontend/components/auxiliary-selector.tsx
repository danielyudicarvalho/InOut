"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  selectorSearch,
  calendarDays,
  calendarMonth,
  displayDate,
  periodLabel,
  type AuxiliaryKind,
} from "@inout/finance";
import { useAuxiliary } from "../lib/finance/use-auxiliary";
export type SelectOption = {
  id: string;
  name: string;
  detail?: string;
  disabled?: boolean;
};
export type CreateOptionContext = {
  household: string;
  kind: AuxiliaryKind;
  flow: string;
  parentId: string;
  currency: string;
  fixedCurrency?: boolean;
  onCreated: (id: string) => void;
};
export function AuxiliarySelector({
  title,
  value,
  items,
  onChange,
  disabled = false,
  create,
  context,
}: {
  title: string;
  value: string;
  items: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  create?: CreateOptionContext;
  context?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="aux-trigger"
        aria-label={`${title}: ${items.find((i) => i.id === value)?.name ?? "Selecione"}`}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {items.find((i) => i.id === value)?.name ?? "Selecione"}
        <span aria-hidden>⌄</span>
      </button>
      {open && (
        <SelectorDialog
          title={title}
          value={value}
          items={items}
          onChange={(id) => {
            onChange(id);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          create={create}
          context={context}
        />
      )}
    </>
  );
}
function SelectorDialog({
  title,
  value,
  items,
  onChange,
  onClose,
  create,
  context,
}: {
  title: string;
  value: string;
  items: SelectOption[];
  onChange: (id: string) => void;
  onClose: () => void;
  create?: CreateOptionContext;
  context?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [query, setQuery] = useState(""),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  const matches = selectorSearch(items, query);
  return createPortal(
    <dialog
      ref={ref}
      className="aux-dialog"
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="aux-content">
        <header>
          <strong>{creating ? "Criar item" : title}</strong>
          <button type="button" aria-label="Fechar seleção" onClick={onClose}>
            ×
          </button>
        </header>
        {creating && create ? (
          <CreateOption {...create} />
        ) : (
          <>
            {context && <p className="aux-context">{context}</p>}
            <input
              autoFocus
              aria-label={`Buscar em ${title}`}
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="aux-options">
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  aria-pressed={item.id === value}
                  onClick={() => onChange(item.id)}
                >
                  <span>
                    {item.name}
                    {item.detail && <small>{item.detail}</small>}
                  </span>
                  {item.id === value && <span aria-hidden>✓</span>}
                </button>
              ))}
              {!matches.length && (
                <p role="status">Nenhum resultado encontrado.</p>
              )}
            </div>
            {create && (
              <button
                type="button"
                className="aux-create"
                onClick={() => setCreating(true)}
              >
                ＋{" "}
                {create.kind === "account"
                  ? "Criar conta"
                  : create.kind === "source"
                    ? "Criar fonte"
                    : create.parentId
                      ? "Criar subcategoria"
                      : "Criar categoria"}
              </button>
            )}
          </>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
function CreateOption(props: CreateOptionContext) {
  const state = useAuxiliary(
      props.household,
      props.kind,
      props.flow,
      props.parentId,
      props.currency,
    ),
    locked = state.status !== "ready";
  if (state.status === "success" && state.result)
    return (
      <div>
        <p role="status">Item criado com sucesso.</p>
        <button type="button" onClick={() => props.onCreated(state.result!.id)}>
          Usar item criado
        </button>
      </div>
    );
  return (
    <div className="aux-create-form">
      <p>O item será salvo nesta residência.</p>
      {state.notice && <p role="alert">{state.notice}</p>}
      {state.status === "loading" ? (
        <p role="status">Carregando…</p>
      ) : state.status === "error" ? (
        <button type="button" onClick={state.retry}>
          Tentar novamente
        </button>
      ) : (
        <>
          <label>
            Nome
            <input
              autoFocus
              maxLength={80}
              disabled={locked}
              value={state.fields.name}
              onChange={(e) => state.edit("name", e.target.value)}
            />
          </label>
          {props.kind === "account" && (
            <>
              <label>
                Moeda
                <input
                  maxLength={3}
                  disabled={locked || props.fixedCurrency}
                  value={state.fields.currency}
                  onChange={(e) =>
                    state.edit("currency", e.target.value.toUpperCase())
                  }
                />
              </label>
              <label>
                Tipo
                <select
                  disabled={locked}
                  value={state.fields.accountKind}
                  onChange={(e) => state.edit("accountKind", e.target.value)}
                >
                  {[
                    ["checking", "Conta corrente"],
                    ["cash", "Dinheiro"],
                    ["savings", "Poupança"],
                    ["investment", "Investimento"],
                    ["other", "Outra"],
                  ].map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <small>A conta será criada com saldo inicial zero.</small>
            </>
          )}
          <button
            type="button"
            className="primary"
            disabled={state.status === "saving"}
            onClick={() => void state.submit()}
          >
            {state.status === "saving"
              ? "Salvando…"
              : state.status === "uncertain"
                ? "Verificar tentativa pendente"
                : "Criar"}
          </button>
        </>
      )}
    </div>
  );
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function DateSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="aux-trigger"
        aria-label={`Selecionar data: ${displayDate(value)}`}
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {displayDate(value)}
        <span aria-hidden>▦</span>
      </button>
      {open && (
        <CalendarDialog
          value={value}
          onClose={() => setOpen(false)}
          onChange={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
function CalendarDialog({
  value,
  onClose,
  onChange,
}: {
  value: string;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [selected, setSelected] = useState(value || today()),
    [month, setMonth] = useState((value || today()).slice(0, 7));
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="aux-dialog"
      aria-label="Selecionar data"
      onCancel={onClose}
    >
      <div className="aux-content">
        <header>
          <strong>Selecionar data</strong>
          <button
            type="button"
            aria-label="Fechar calendário"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="aux-month">
          <button
            type="button"
            disabled={month === "2000-01"}
            aria-label="Mês anterior"
            onClick={() => setMonth(calendarMonth(month, -1))}
          >
            ‹
          </button>
          <strong>{periodLabel(month)}</strong>
          <button
            type="button"
            disabled={month === "9998-12"}
            aria-label="Próximo mês"
            onClick={() => setMonth(calendarMonth(month, 1))}
          >
            ›
          </button>
        </div>
        <div className="aux-calendar">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <small key={d}>{d}</small>
          ))}
          {calendarDays(month).map((date, i) =>
            date ? (
              <button
                type="button"
                key={date}
                aria-label={displayDate(date)}
                aria-pressed={date === selected}
                onClick={() => setSelected(date)}
              >
                {Number(date.slice(8))}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
        <footer>
          <button
            type="button"
            onClick={() => {
              setSelected(today());
              setMonth(today().slice(0, 7));
            }}
          >
            Hoje
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => onChange(selected)}
          >
            Confirmar
          </button>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
