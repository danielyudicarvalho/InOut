"use client";

import {
  CalendarBlank,
  CreditCard,
  ShoppingCart,
  Coins,
  ArrowsLeftRight,
  Clock,
  TrendDown,
  TrendUp,
} from "@phosphor-icons/react";
import { money, displayDate, type RecordKind } from "@inout/finance";

export interface VerificationCardProps {
  kind: RecordKind;
  description: string;
  amount: number;
  currency: string;
  accountName: string;
  date: string;
}

export function VerificationCard({
  kind,
  description,
  amount,
  currency,
  accountName,
  date,
}: VerificationCardProps) {
  const isExpense = kind === "expense";
  const isIncome = kind === "income";
  const isTransfer = kind === "transfer";

  const formattedAmount = money(Math.abs(amount), currency);

  return (
    <section className="verification-card" aria-label="Dados do lançamento em verificação">
      <div className="verification-card-header">
        <div className="verification-icon-circle">
          {isTransfer ? (
            <ArrowsLeftRight size={22} weight="bold" />
          ) : isIncome ? (
            <Coins size={22} weight="bold" />
          ) : (
            <ShoppingCart size={22} weight="bold" />
          )}
        </div>
        <strong className="verification-record-title">
          {description.trim() ||
            (isTransfer
              ? "Transferência"
              : isIncome
                ? "Entrada"
                : "Saída")}
        </strong>
        <div className="verification-badge">
          <Clock size={15} weight="bold" />
          <span>Em verificação</span>
        </div>
      </div>

      <div className="verification-card-grid">
        <div className="verification-grid-item">
          <dt>
            {isExpense ? (
              <TrendDown size={16} className="trend-down" />
            ) : (
              <TrendUp size={16} className="trend-up" />
            )}
            <span>Tipo</span>
          </dt>
          <dd>
            {isExpense
              ? "Saída"
              : isIncome
                ? "Entrada"
                : "Transferência"}
          </dd>
        </div>

        <div className="verification-grid-item">
          <dt>
            <Coins size={16} />
            <span>Valor</span>
          </dt>
          <dd className="verification-amount">{formattedAmount}</dd>
        </div>

        <div className="verification-grid-item">
          <dt>
            <CreditCard size={16} />
            <span>Conta</span>
          </dt>
          <dd>{accountName || "Conta principal"}</dd>
        </div>

        <div className="verification-grid-item">
          <dt>
            <CalendarBlank size={16} />
            <span>Data</span>
          </dt>
          <dd>{displayDate(date)}</dd>
        </div>
      </div>
    </section>
  );
}
