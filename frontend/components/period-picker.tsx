"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  calendarDays,
  parsePeriod,
  periodLabel,
  presetPeriod,
  rangePeriod,
  displayDate,
  financeMessage,
} from "@inout/finance";
export function PeriodPicker({
  value,
  onApply,
  onClose,
}: {
  value: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const bounds = parsePeriod(value);
  const [from, setFrom] = useState(bounds.from),
    [to, setTo] = useState(bounds.to);
  const [month, setMonth] = useState(bounds.from.slice(0, 7));
  const [preset, setPreset] = useState(() =>
    value === presetPeriod("current")
      ? "current"
      : value === presetPeriod("previous")
        ? "previous"
        : value === presetPeriod("quarter")
          ? "quarter"
          : "custom",
  );
  const [selection, setSelection] = useState(value);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  function quick(kind: "current" | "previous" | "quarter") {
    const next = presetPeriod(kind),
      b = parsePeriod(next);
    setFrom(b.from);
    setTo(b.to);
    setMonth(b.from.slice(0, 7));
    setPreset(kind);
    setSelection(next);
    setSelectingEnd(false);
    setError("");
  }
  function edit(field: "from" | "to", date: string) {
    if (field === "from") setFrom(date);
    else setTo(date);
    setPreset("custom");
    setSelectingEnd(false);
    setError("");
  }
  function day(date: string) {
    setPreset("custom");
    setError("");
    if (!selectingEnd || date < from) {
      setFrom(date);
      setTo("");
      setSelectingEnd(true);
    } else {
      setTo(date);
      setSelectingEnd(false);
    }
  }
  function move(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    if (d.getFullYear() < 2000 || d.getFullYear() > 9998) return;
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  let label = "Selecione o início e o fim do intervalo.";
  try {
    label = periodLabel(rangePeriod(from, to));
  } catch {}
  function apply(event: FormEvent) {
    event.preventDefault();
    try {
      const period = rangePeriod(from, to);
      onApply(preset === "custom" ? period : selection);
    } catch (e) {
      setError(financeMessage(e));
    }
  }
  return (
    <dialog
      ref={dialog}
      className="period-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="period-title"
    >
      <form onSubmit={apply}>
        <button
          className="period-close"
          type="button"
          aria-label="Fechar seleção de período"
          onClick={onClose}
        >
          ×
        </button>
        <div className="period-heading">
          <Image
            src="/images/pipo-period.webp"
            alt=""
            width={120}
            height={90}
          />
          <div>
            <h2 id="period-title">Selecionar período</h2>
            <p>Escolha quando olhar para suas finanças.</p>
          </div>
        </div>
        <div
          className="period-presets"
          role="group"
          aria-label="Atalhos de período"
        >
          {[
            { id: "current", label: "Este mês" },
            { id: "previous", label: "Mês passado" },
            { id: "quarter", label: "Últimos 3 meses" },
          ].map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={preset === item.id}
              onClick={() =>
                quick(item.id as "current" | "previous" | "quarter")
              }
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={preset === "custom"}
            onClick={() => setPreset("custom")}
          >
            Personalizado
          </button>
        </div>
        <div className="period-month">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <label>
            <span className="sr-only">Mês do calendário</span>
            <input
              type="month"
              min="2000-01"
              max="9998-12"
              value={month}
              onChange={(e) => {
                try {
                  parsePeriod(e.target.value);
                  setMonth(e.target.value);
                } catch {}
              }}
            />
          </label>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => move(1)}
          >
            ›
          </button>
        </div>
        <div className="period-weekdays" aria-hidden="true">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div
          className="period-days"
          role="group"
          aria-label={periodLabel(month)}
        >
          {calendarDays(month).map((date, index) =>
            date ? (
              <button
                key={date}
                type="button"
                onClick={() => day(date)}
                aria-label={displayDate(date)}
                aria-pressed={date === from || date === to}
                className={`${date === from || date === to ? "endpoint" : ""} ${date > from && date < to ? "in-range" : ""}`}
              >
                {Number(date.slice(8))}
              </button>
            ) : (
              <span key={index} />
            ),
          )}
        </div>
        <div className="period-fields">
          <label>
            Data inicial
            <input
              type="date"
              required
              min="2000-01-01"
              max="9998-12-31"
              value={from}
              onChange={(e) => edit("from", e.target.value)}
              aria-describedby="period-error"
            />
          </label>
          <label>
            Data final
            <input
              type="date"
              required
              min="2000-01-01"
              max="9998-12-31"
              value={to}
              onChange={(e) => edit("to", e.target.value)}
              aria-describedby="period-error"
            />
          </label>
        </div>
        <p className="period-help">
          {selectingEnd
            ? "Agora selecione a data final."
            : "Selecione o início e o fim do intervalo."}
        </p>
        <p className="period-summary" aria-live="polite">
          {label}
        </p>
        <p id="period-error" role="alert" className="period-error">
          {error}
        </p>
        <div className="period-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" type="submit">
            Aplicar período
          </button>
        </div>
      </form>
    </dialog>
  );
}
