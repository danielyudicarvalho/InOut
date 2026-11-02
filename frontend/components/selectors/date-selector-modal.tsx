"use client";

import { useEffect, useRef, useState } from "react";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function DateSelectorModal({
  value,
  onSelect,
  onClose,
}: {
  value: string; // YYYY-MM-DD
  onSelect: (dateString: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Parse initial date YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  const [viewYear, setViewYear] = useState(() => {
    const parts = (selectedDate || value).split("-").map(Number);
    return parts[0] || new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState(() => {
    const parts = (selectedDate || value).split("-").map(Number);
    return (parts[1] || new Date().getMonth() + 1) - 1; // 0-indexed
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => dialog?.close();
  }, []);

  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleToday() {
    const today = new Date();
    const str = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setSelectedDate(str);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  function handleConfirm() {
    onSelect(selectedDate);
    onClose();
  }

  // Generate calendar days for viewYear, viewMonth
  // JavaScript Date: day of week (0 is Sunday, 1 is Monday ... 6 is Saturday)
  // We want Monday = 0, Tuesday = 1, ... Sunday = 6
  const firstDay = new Date(viewYear, viewMonth, 1);
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const rawFirstWeekday = firstDay.getDay(); // 0 is Sun
  const offset = (rawFirstWeekday + 6) % 7; // 0 is Mon, 6 is Sun

  const days: { day: number; dateString: string }[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ day: d, dateString: dateStr });
  }

  return (
    <dialog
      ref={dialogRef}
      className="ninho-selector-dialog"
      aria-labelledby="date-selector-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          ) {
            onClose();
          }
        }
      }}
    >
      <div className="ninho-selector-panel ninho-calendar-panel">
        <header className="ninho-selector-header">
          <div>
            <h2 id="date-selector-title">Selecionar data</h2>
            <p className="ninho-selector-subtitle">Escolha a data que melhor se encaixa.</p>
          </div>
          <button
            type="button"
            className="ninho-selector-close"
            aria-label="Fechar seleção de data"
            onClick={onClose}
          >
            <X size={20} weight="bold" />
          </button>
        </header>

        <div className="ninho-calendar-nav">
          <button
            type="button"
            aria-label="Mês anterior"
            className="ninho-calendar-nav-btn"
            onClick={handlePrevMonth}
          >
            <CaretLeft size={18} weight="bold" />
          </button>
          <strong className="ninho-calendar-title">
            {MONTH_NAMES[viewMonth]} de {viewYear}
          </strong>
          <button
            type="button"
            aria-label="Próximo mês"
            className="ninho-calendar-nav-btn"
            onClick={handleNextMonth}
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>

        <div className="ninho-calendar-grid" role="grid" aria-label="Calendário de dias">
          <div className="ninho-calendar-weekdays" role="row">
            {WEEKDAY_NAMES.map((name) => (
              <span key={name} role="columnheader" className="ninho-calendar-weekday">
                {name}
              </span>
            ))}
          </div>

          <div className="ninho-calendar-days">
            {Array.from({ length: offset }).map((_, i) => (
              <span key={`blank-${i}`} className="ninho-calendar-blank" aria-hidden="true" />
            ))}
            {days.map(({ day, dateString }) => {
              const isSelected = dateString === selectedDate;
              return (
                <button
                  type="button"
                  key={dateString}
                  className={`ninho-calendar-day ${isSelected ? "selected" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDate(dateString)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="ninho-calendar-footer">
          <button
            type="button"
            className="ninho-selector-cancel-btn"
            onClick={handleToday}
          >
            Hoje
          </button>
          <button
            type="button"
            className="ninho-selector-confirm-btn"
            onClick={handleConfirm}
          >
            Confirmar
          </button>
        </footer>
      </div>
    </dialog>
  );
}
