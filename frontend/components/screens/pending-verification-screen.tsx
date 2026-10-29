"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowsClockwise,
  Bell,
  CalendarBlank,
  CreditCard,
  FileText,
  MagnifyingGlass,
  Plant,
  ShoppingCart,
  TrendDown,
  TrendUp,
  WarningCircle,
  Coins,
  Clock,
  ArrowsLeftRight,
  House,
  CaretDown,
} from "@phosphor-icons/react";
import { money, displayDate, type RecordKind, type RecordReview } from "@inout/finance";
import { BrandLogo } from "../ui/brand-logo";
import { useFinancialHome } from "../../lib/finance/use-financial-home";
import { DashboardSidebar } from "../layout/dashboard-sidebar";

export function PendingVerificationScreen({
  household = "",
  householdName = "",
  kind = "expense",
  summary = null,
  description = "",
  amount = 0,
  currency = "BRL",
  accountName = "",
  date = "",
  historyHref,
  onRetry,
  submitting = false,
}: {
  household?: string;
  householdName?: string;
  kind?: RecordKind;
  summary?: RecordReview | null;
  description?: string;
  amount?: number | string;
  currency?: string;
  accountName?: string;
  date?: string;
  historyHref?: string;
  onRetry?: () => void;
  submitting?: boolean;
}) {
  const p = useSearchParams();
  const router = useRouter();

  const qHousehold = p?.get("household") || household;
  const qKind = ((p?.get("kind") as RecordKind) || kind || "expense") as RecordKind;
  const qDescription = p?.get("description") ?? description;
  const rawAmount = p?.get("amount") ?? amount;
  const qAmount =
    typeof rawAmount === "string"
      ? Math.round((parseFloat(rawAmount.replace(",", ".")) || 0) * 100)
      : rawAmount;
  const qCurrency = p?.get("currency") || currency || "BRL";
  const qAccount = p?.get("account") || accountName;
  const qDate = p?.get("date") || date || new Date().toISOString().slice(0, 10);
  const qPeriod = p?.get("period") || qDate.slice(0, 7);

  const home = useFinancialHome({
    initialHouseholdId: qHousehold,
    initialPeriod: qPeriod,
  });

  const activeHouseholdName =
    householdName ||
    home.households.find((h) => h.id === (qHousehold || home.householdId))?.name ||
    "Residência";

  const resolvedHousehold = qHousehold || home.householdId || "";

  const [checking, setChecking] = useState(false);

  const backToHistory =
    historyHref ||
    `/lancamentos?${new URLSearchParams({
      ...(resolvedHousehold ? { household: resolvedHousehold } : {}),
      ...(qPeriod ? { period: qPeriod } : {}),
      currency: qCurrency,
    })}`;

  const handleVerifyAgain = () => {
    if (onRetry) {
      onRetry();
    } else {
      setChecking(true);
      setTimeout(() => {
        setChecking(false);
        router.push(backToHistory);
      }, 1000);
    }
  };

  const isExpense = qKind === "expense";
  const isIncome = qKind === "income";
  const isTransfer = qKind === "transfer";

  const formattedAmount = money(Math.abs(qAmount), qCurrency);

  return (
    <main className="dashboard verification-page">
      <DashboardSidebar
        household={resolvedHousehold}
        period={qPeriod}
        currency={qCurrency}
        activePage="lancamentos"
        quote="Sonhos também contam"
      />

      <div className="verification-content">
        <header className="verification-topbar">
          <div className="residence-pill">
            <House size={18} weight="fill" />
            <span>{activeHouseholdName}</span>
            <CaretDown size={14} weight="bold" />
          </div>

          <div className="topbar-actions">
            <button className="topbar-icon-btn" aria-label="Pesquisar">
              <MagnifyingGlass size={19} />
            </button>
            <button className="topbar-icon-btn" aria-label="Notificações">
              <Bell size={19} />
            </button>
            <div className="user-avatar-sprout" aria-label="Usuário">
              <Plant size={18} weight="fill" />
            </div>
          </div>
        </header>

        <div className="verification-body">
          <div className="verification-hero-artwork">
            <Image
              src="/images/pipo-verifying-record.webp"
              alt="Pipo verificando lançamento com caderno e ampulheta"
              width={380}
              height={230}
              priority
            />
          </div>

          <h1 className="verification-title">Estamos verificando seu lançamento</h1>
          <p className="verification-subtitle">
            Ainda não foi possível confirmar o resultado. Ele pode já ter sido
            registrado.
          </p>

          <section
            className="verification-card"
            aria-label="Dados do lançamento em verificação"
          >
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
                {qDescription.trim() ||
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
                <dd>{qAccount || "—"}</dd>
              </div>

              <div className="verification-grid-item">
                <dt>
                  <CalendarBlank size={16} />
                  <span>Data</span>
                </dt>
                <dd>{displayDate(qDate)}</dd>
              </div>
            </div>

            <div className="verification-card-warning" role="alert">
              <WarningCircle size={20} weight="fill" />
              <span>
                Para evitar duplicidade, não crie outro lançamento igual
                enquanto verificamos.
              </span>
            </div>
          </section>

          <div className="verification-actions">
            <button
              className="verification-primary-btn"
              onClick={handleVerifyAgain}
              disabled={submitting || checking}
            >
              <ArrowsClockwise
                size={18}
                weight="bold"
                className={submitting || checking ? "spin" : ""}
              />
              <span>
                {submitting || checking
                  ? "Verificando…"
                  : "Verificar novamente"}
              </span>
            </button>

            <Link className="verification-secondary-btn" href={backToHistory}>
              <FileText size={18} />
              <span>Ir ao histórico</span>
            </Link>

            <small className="verification-actions-help">
              Ao verificar novamente, consultamos esta mesma operação.
            </small>
          </div>

          <aside className="verification-bottom-notice">
            <Plant size={19} weight="fill" />
            <span>
              Você pode sair desta tela e conferir o resultado no histórico.
            </span>
          </aside>
        </div>
      </div>
    </main>
  );
}
