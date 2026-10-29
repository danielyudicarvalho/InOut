"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Bell,
  MagnifyingGlass,
  Plant,
  House,
  CaretDown,
} from "@phosphor-icons/react";
import type { RecordKind, RecordReview } from "@inout/finance";
import { useFinancialHome } from "../../lib/finance/use-financial-home";
import { usePendingVerification } from "../../lib/finance/use-pending-verification";
import { DashboardSidebar } from "../layout/dashboard-sidebar";
import {
  VerificationCard,
  VerificationWarning,
  VerificationActions,
  VerificationBottomNotice,
} from "../financial/verification";

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

  const resolvedHousehold = qHousehold || home.householdId || "";
  const activeHouseholdName =
    householdName ||
    home.households.find((h) => h.id === resolvedHousehold)?.name ||
    "Nosso Ninho";

  // Real backend verification integration
  const backend = usePendingVerification({
    householdId: resolvedHousehold,
    initialKind: qKind,
    initialCurrency: qCurrency,
    initialDescription: qDescription,
    initialAmount: qAmount,
    initialDate: qDate,
    initialAccount: qAccount,
  });

  const backToHistory =
    historyHref ||
    `/lancamentos?${new URLSearchParams({
      ...(resolvedHousehold ? { household: resolvedHousehold } : {}),
      ...(qPeriod ? { period: qPeriod } : {}),
      currency: qCurrency,
    })}`;

  // When backend confirms the operation, redirect to the recorded transaction
  useEffect(() => {
    if (backend.confirmedTransaction) {
      router.replace(
        `/lancamento?${new URLSearchParams({
          ...(resolvedHousehold ? { household: resolvedHousehold } : {}),
          transaction: backend.confirmedTransaction,
          ...(qPeriod ? { period: qPeriod } : {}),
          currency: qCurrency,
        })}`,
      );
    }
  }, [backend.confirmedTransaction, resolvedHousehold, qPeriod, qCurrency, router]);

  const handleVerify = () => {
    if (onRetry) {
      onRetry();
    } else {
      void backend.verify();
    }
  };

  const isSubmitting = submitting || backend.status === "verifying";

  // Use either active hook data or query params
  const activeDescription = backend.data.hasStoredPending ? backend.data.description : qDescription;
  const activeAmount = backend.data.hasStoredPending ? backend.data.amount : qAmount;
  const activeDate = backend.data.hasStoredPending ? backend.data.date : qDate;
  const activeKind = backend.data.hasStoredPending ? backend.data.kind : qKind;

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
            <button className="topbar-icon-btn" aria-label="Pesquisar" type="button">
              <MagnifyingGlass size={19} />
            </button>
            <button className="topbar-icon-btn" aria-label="Notificações" type="button">
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
              width={420}
              height={260}
              priority
            />
          </div>

          <h1 className="verification-title">Estamos verificando seu lançamento</h1>
          <p className="verification-subtitle">
            Ainda não foi possível confirmar o resultado. Ele pode já ter sido
            registrado.
          </p>

          {backend.notice && backend.status === "uncertain" ? (
            <p className="verification-notice" role="alert">
              {backend.notice}
            </p>
          ) : null}

          <VerificationCard
            kind={activeKind}
            description={activeDescription}
            amount={activeAmount}
            currency={qCurrency}
            accountName={qAccount}
            date={activeDate}
          />

          <VerificationWarning />

          <VerificationActions
            onVerify={handleVerify}
            historyHref={backToHistory}
            submitting={isSubmitting}
          />

          <VerificationBottomNotice />
        </div>
      </div>
    </main>
  );
}
