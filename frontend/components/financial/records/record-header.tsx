"use client";

import Link from "next/link";
import Image from "next/image";
import type { RecordKind } from "@inout/finance";

const titles: Record<RecordKind, string> = {
  income: "Nova entrada",
  expense: "Nova saída",
  transfer: "Nova transferência",
};

interface RecordHeaderProps {
  kind: RecordKind;
  householdName: string;
  backHref: string;
  showReview: boolean;
  status: string;
  onBackToEdit?: () => void;
}

export function RecordHeader({
  kind,
  householdName,
  backHref,
  showReview,
  status,
  onBackToEdit,
}: RecordHeaderProps) {
  const isReady = status === "ready";

  return (
    <header>
      <Link
        className="balance-back"
        href={backHref}
        onClick={(e) => {
          if (showReview && isReady && onBackToEdit) {
            e.preventDefault();
            onBackToEdit();
          }
        }}
      >
        {showReview && isReady ? `‹ ${titles[kind]}` : "‹ Lançamentos"}
      </Link>
      <Image
        src={
          showReview
            ? "/images/pipo-review.webp"
            : kind === "income"
              ? "/images/pipo-income-form.webp"
              : kind === "expense"
                ? "/images/pipo-expense-form.webp"
                : "/images/pipo-transfer-form.webp"
        }
        width={600}
        height={300}
        sizes="260px"
        alt={
          showReview
            ? "Pipo revisando uma lista no caderno"
            : kind === "income"
              ? "Pipo guardando uma moeda em uma bolsinha"
              : kind === "expense"
                ? "Pipo conferindo as compras e o recibo"
                : "Pipo levando uma moeda pela ponte entre duas contas"
        }
      />
      <p>{householdName}</p>
      <h1>
        {status === "success"
          ? "Lançamento registrado"
          : showReview
            ? "Revise seu lançamento"
            : titles[kind]}
      </h1>
      <p>
        {showReview
          ? "Confira os dados antes de confirmar."
          : kind === "transfer"
            ? "Mova dinheiro entre as contas do seu lar."
            : kind === "income"
              ? "Registre um dinheiro que entrou no seu lar."
              : "Registre um gasto do seu lar."}
      </p>
    </header>
  );
}

export { titles as recordTitles };
