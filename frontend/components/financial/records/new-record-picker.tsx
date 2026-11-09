"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowsLeftRight, X } from "@phosphor-icons/react";
export function NewRecordPicker({
  household,
  period,
  currency,
  onClose,
  fresh = false,
}: {
  household: string;
  period: string;
  currency: string;
  onClose: () => void;
  fresh?: boolean;
}) {
  const [draft] = useState(() => Date.now().toString(36));
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="new-record-dialog"
      aria-labelledby="new-record-title"
      aria-describedby="new-record-description"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <button
        className="new-record-close"
        aria-label="Fechar novo registro"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      <Image
        src="/images/pipo-new-record.webp"
        width={600}
        height={300}
        sizes="(max-width: 600px) 230px, 320px"
        alt="Pipo escrevendo em um caderno"
        className="new-record-art"
        preload
      />
      <h2 id="new-record-title">O que vamos registrar?</h2>
      <p id="new-record-description">Escolha o tipo de movimentação.</p>
      <div className="new-record-choices">
        {[
          {
            kind: "income",
            title: "Nova entrada",
            description: "Registre um dinheiro que entrou.",
            Icon: ArrowUp,
          },
          {
            kind: "expense",
            title: "Nova saída",
            description: "Registre um gasto do seu lar.",
            Icon: ArrowDown,
          },
          {
            kind: "transfer",
            title: "Transferência",
            description: "Mova dinheiro entre suas contas.",
            Icon: ArrowsLeftRight,
          },
        ].map(({ kind, title, description, Icon }) => (
          <Link
            key={kind}
            className={`new-record-choice ${kind}`}
            href={`/novo-registro?${new URLSearchParams({ household, period, currency, kind, ...(fresh ? { draft } : {}) })}`}
            onClick={onClose}
          >
            <span className="new-record-icon">
              <Icon size={30} weight="bold" aria-hidden="true" />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
            <span aria-hidden="true">›</span>
          </Link>
        ))}
      </div>
      <p className="new-record-footnote">
        ⓘ Transferências não contam como receita ou despesa.
      </p>
    </dialog>
  );
}
