"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowsClockwise, WarningCircle, X } from "@phosphor-icons/react";
import { historyKind, money, type TransactionDetail } from "@inout/finance";
export function TransactionConflictDialog({
  detail,
  busy,
  error,
  back,
  onReload,
  onClose,
}: {
  detail: TransactionDetail;
  busy: boolean;
  error: string;
  back: string;
  onReload: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="transaction-dialog conflict-dialog"
      aria-labelledby="conflict-title"
      aria-describedby="conflict-explanation"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="conflict-panel" aria-busy={busy}>
        <button
          className="transaction-close"
          aria-label="Fechar aviso"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <Image
          className="conflict-art"
          src="/images/pipo-conflict.webp"
          alt=""
          width={440}
          height={235}
        />
        <h2 id="conflict-title">Este lançamento foi atualizado</h2>
        <p className="conflict-lead">
          O registro mudou desde que você abriu esta tela.
        </p>
        <p id="conflict-explanation">
          Sua alteração não foi aplicada. Recarregue os dados para conferir a
          versão atual e as ações disponíveis.
        </p>
        <div className="conflict-summary">
          <span
            aria-hidden="true"
            className={`transaction-icon ${detail.amount < 0 ? "out" : "in"}`}
          >
            {detail.kind === "transfer" ? "⇄" : detail.amount < 0 ? "↓" : "↑"}
          </span>
          <div>
            <strong>{detail.description}</strong>
            <span
              className={
                detail.amount < 0 ? "transaction-out" : "transaction-in"
              }
            >
              {historyKind(detail)} · {money(detail.amount, detail.currency)}
            </span>
            <small>
              {detail.postings.map((p) => p.accountName).join(" → ")}
            </small>
          </div>
        </div>
        <p className="transaction-warning">
          <WarningCircle size={22} weight="fill" aria-hidden="true" />
          Nenhuma alteração sua foi salva.
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          className="transaction-primary"
          autoFocus
          disabled={busy}
          onClick={onReload}
        >
          <ArrowsClockwise size={19} aria-hidden="true" />
          {busy ? "Recarregando…" : "Recarregar dados"}
        </button>
        <Link className="transaction-secondary" href={back}>
          Voltar ao histórico
        </Link>
      </div>
    </dialog>
  );
}
