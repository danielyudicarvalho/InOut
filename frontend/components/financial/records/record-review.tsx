"use client";
import { useEffect, useRef } from "react";
import {
  money,
  type RecordKind,
  type RecordFields,
  type RecordReview,
} from "@inout/finance";
export function RecordReviewPanel({
  kind,
  summary,
  status,
  notice,
  onEdit,
  onConfirm,
}: {
  kind: RecordKind;
  summary: RecordReview | null;
  status: string;
  notice: string;
  onEdit: (field?: keyof RecordFields) => void;
  onConfirm: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const pending = status === "uncertain",
    saving = status === "saving",
    noun =
      kind === "expense"
        ? "saída"
        : kind === "income"
          ? "entrada"
          : "transferência";
  return (
    <section
      className={`record-review-panel ${kind === "expense" ? "review-expense" : ""}`}
      aria-labelledby="review-summary-title"
    >
      <div className="review-summary">
        <div>
          <h2 ref={heading} tabIndex={-1} id="review-summary-title">
            Resumo da {noun}
          </h2>
          {summary && (
            <strong className="review-amount">
              {money(summary.amount, summary.currency)}
            </strong>
          )}
        </div>
        <span className="review-badge" role="status">
          {pending
            ? "Confirmação pendente"
            : saving
              ? "Registrando…"
              : "Ainda não registrado"}
        </span>
      </div>
      {notice && (
        <p role="alert" className="record-notice">
          {notice}
        </p>
      )}
      {summary ? (
        <dl className="review-rows">
          {summary.rows.map((row, i) => (
            <div key={i}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
              {row.field && (
                <button
                  type="button"
                  disabled={saving || pending}
                  aria-label={`Editar ${row.label}`}
                  onClick={() => onEdit(row.field!)}
                >
                  ✎ Editar
                </button>
              )}
            </div>
          ))}
        </dl>
      ) : (
        <p>
          Não foi possível montar o resumo com os catálogos atuais. A tentativa
          anterior continua protegida.
        </p>
      )}
      <p className="review-info">
        {pending
          ? "O resultado da tentativa anterior ainda não foi confirmado. Verifique usando a mesma tentativa."
          : kind === "transfer"
            ? "Ao confirmar, o valor será movido entre as contas. Transferências não contam como receita ou despesa."
            : `Ao confirmar, esta ${noun} será registrada na conta escolhida.`}
      </p>
      <footer>
        <button
          type="button"
          disabled={saving || pending}
          onClick={() => onEdit()}
        >
          Editar dados
        </button>
        <button
          type="button"
          className="primary"
          disabled={saving}
          onClick={onConfirm}
        >
          {saving
            ? "Registrando…"
            : pending
              ? "Verificar tentativa pendente"
              : `Confirmar ${noun}`}
        </button>
      </footer>
    </section>
  );
}
