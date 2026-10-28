"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  displayDate,
  historyKind,
  money,
  reversalEffects,
  type TransactionDetail,
} from "@inout/finance";
import { DateSelector } from "./auxiliary-selector";
export type ReversalDialogProps = {
  detail: TransactionDetail;
  date: string;
  description: string;
  pending: boolean;
  saving: boolean;
  notice: string;
  onEdit: (field: "date" | "description", value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};
export function ReversalDialog({
  detail,
  date,
  description,
  pending,
  saving,
  notice,
  onEdit,
  onClose,
  onConfirm,
}: ReversalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  const effects = reversalEffects(detail),
    classification = detail.rows
      .filter((r) => ["Categoria", "Subcategoria"].includes(r.label))
      .map((r) => r.value)
      .join(" › ");
  return (
    <dialog
      ref={ref}
      className="aux-dialog reversal-dialog"
      aria-labelledby="reversal-title"
      aria-describedby="reversal-effect"
      onCancel={(e) => {
        if (saving) e.preventDefault();
        else onClose();
      }}
    >
      <form
        className="aux-content"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm();
        }}
      >
        <header>
          <div>
            <h2 id="reversal-title">
              {pending
                ? "Estorno com confirmação pendente"
                : "Confirmar estorno"}
            </h2>
            <p>Confira o lançamento e o efeito desta ação.</p>
          </div>
          <button
            type="button"
            aria-label="Fechar confirmação"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <Image
          className="reversal-art"
          src="/images/pipo-reversal.webp"
          alt=""
          width={380}
          height={140}
        />
        <section className="reversal-original" aria-label="Lançamento original">
          <h3>Lançamento original</h3>
          <div>
            <strong>{detail.description}</strong>
            <strong
              className={
                detail.amount < 0 ? "transaction-out" : "transaction-in"
              }
            >
              {money(detail.amount, detail.currency)}
            </strong>
          </div>
          <small>{historyKind(detail)}</small>
          <p>{detail.postings.map((p) => p.accountName).join(" → ")}</p>
          {classification && <p>{classification}</p>}
          <small>{displayDate(detail.date)}</small>
        </section>
        <section className="reversal-effect" id="reversal-effect">
          <h3>O que vai acontecer?</h3>
          {effects.map((effect, i) => (
            <p key={i}>
              Será criado um {effect.amount < 0 ? "débito" : "crédito"} de{" "}
              <strong>{money(Math.abs(effect.amount), effect.currency)}</strong>{" "}
              na conta <strong>{effect.accountName}</strong>.
            </p>
          ))}
          <p>
            O lançamento original continuará no histórico, marcado como
            estornado.
          </p>
        </section>
        <p className="reversal-bank-note">
          Isso corrige os registros no Ninho. Não realiza reembolso bancário.
        </p>
        {notice && <p role="alert">{notice}</p>}
        <label>
          <span>
            Motivo do estorno {!pending && <b aria-hidden="true">*</b>}
          </span>
          <textarea
            aria-label="Motivo do estorno"
            aria-describedby="reversal-reason-help"
            required={!pending}
            maxLength={500}
            disabled={pending || saving}
            value={description}
            onChange={(e) => onEdit("description", e.target.value)}
            placeholder={
              pending && !description
                ? "Motivo não informado na tentativa anterior"
                : "Informe o motivo da correção"
            }
          />
        </label>
        <small id="reversal-reason-help">
          Informe o motivo para manter o histórico da correção. Campo
          obrigatório para novos estornos.
        </small>
        <details className="reversal-date">
          <summary>Data do estorno: {displayDate(date)}</summary>
          <DateSelector
            value={date}
            disabled={pending || saving}
            onChange={(value) => onEdit("date", value)}
          />
        </details>
        <footer>
          <button type="button" disabled={saving} onClick={onClose}>
            {pending ? "Fechar sem descartar tentativa" : "Cancelar"}
          </button>
          <button type="submit" className="reversal-confirm" disabled={saving}>
            {saving
              ? "Estornando…"
              : pending
                ? "Verificar mesma tentativa"
                : "Confirmar estorno"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
