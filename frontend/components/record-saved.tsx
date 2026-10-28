"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { money, type RecordKind, type RecordReview } from "@inout/finance";
export function RecordSaved({
  kind,
  summary,
  description,
  transactionId,
  historyHref,
  detailHref,
  onNew,
}: {
  kind: RecordKind;
  summary: RecordReview | null;
  description: string;
  transactionId: string;
  historyHref: string;
  detailHref: string;
  onNew: () => void;
}) {
  const title =
      kind === "expense"
        ? "Saída registrada!"
        : kind === "income"
          ? "Entrada registrada!"
          : "Transferência registrada!",
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section
      data-transaction-id={transactionId}
      className={`saved-panel ${kind === "expense" ? "saved-expense" : ""}`}
    >
      <Image
        className="saved-art"
        src="/images/pipo-saved.webp"
        alt="Pipo carimbando um caderno com uma marca de confirmação"
        width={600}
        height={300}
        sizes="(max-width:700px) 85vw, 400px"
      />
      <div className="saved-check" aria-hidden>
        ✓
      </div>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <p role="status">Seu lançamento foi salvo no Ninho.</p>
      <div className="saved-summary">
        <header>
          <strong>{description.trim() || "Sem descrição"}</strong>
          <span>● Registrado</span>
        </header>
        <dl>
          <div>
            <dt>Tipo</dt>
            <dd>
              {kind === "income"
                ? "Entrada"
                : kind === "expense"
                  ? "Saída"
                  : "Transferência"}
            </dd>
          </div>
          {summary && (
            <>
              <div>
                <dt>Valor</dt>
                <dd className="saved-amount">
                  {money(summary.amount, summary.currency)}
                </dd>
              </div>
              {summary.rows
                .filter(
                  (row) => !["Descrição", "Subcategoria"].includes(row.label),
                )
                .map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>
                      {row.value}
                      {row.label === "Categoria" &&
                      summary.rows.some((r) => r.label === "Subcategoria")
                        ? ` › ${summary.rows.find((r) => r.label === "Subcategoria")?.value}`
                        : ""}
                    </dd>
                  </div>
                ))}
            </>
          )}
        </dl>
      </div>
      <div className="saved-actions">
        <Link className="primary" href={detailHref}>
          ▤ Ver lançamento
        </Link>
        <button type="button" onClick={onNew}>
          ⊕ Novo registro
        </button>
        <Link href={historyHref}>Voltar ao histórico</Link>
      </div>
    </section>
  );
}
