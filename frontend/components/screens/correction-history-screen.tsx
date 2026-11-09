"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowsClockwise,
  Coins,
  Eye,
  Info,
  ShoppingCart,
  ArrowsLeftRight,
  User,
} from "@phosphor-icons/react";
import { money, type CorrectionChainStep } from "@inout/finance";
import { BrandLogo } from "../ui/brand-logo";
import { useCorrectionHistory } from "../../lib/finance/use-correction-history";

export function CorrectionHistoryScreen() {
  const p = useSearchParams();
  const household = p.get("household") ?? "";
  const transactionId = p.get("transaction") ?? "";
  const period = p.get("period") ?? "";
  const currency = p.get("currency") ?? "";

  return (
    <CorrectionHistoryView
      key={`${household}:${transactionId}`}
      household={household}
      transactionId={transactionId}
      period={period}
      currency={currency}
    />
  );
}

function formatAuditDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const dateFormatted = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
    const timeFormatted = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `${dateFormatted} às ${timeFormatted}`;
  } catch {
    return dateString;
  }
}

function StepIcon({ step }: { step: CorrectionChainStep }) {
  if (step.kind === "reversal") {
    return <ArrowsClockwise size={24} weight="bold" />;
  }
  if (step.detail.kind === "transfer") {
    return <ArrowsLeftRight size={24} weight="bold" />;
  }
  if (step.detail.kind === "income") {
    return <Coins size={24} weight="bold" />;
  }
  return <ShoppingCart size={24} weight="bold" />;
}

function CorrectionHistoryView({
  household,
  transactionId,
  period,
  currency,
}: {
  household: string;
  transactionId: string;
  period: string;
  currency: string;
}) {
  const state = useCorrectionHistory(household, transactionId);

  const backToHistory = `/lancamentos?${new URLSearchParams({
    household,
    ...(period ? { period } : {}),
    ...(currency ? { currency } : {}),
  })}`;

  const target = (id: string) =>
    `/lancamento?${new URLSearchParams({
      household,
      transaction: id,
      ...(period ? { period } : {}),
      currency: state.chain?.currency ?? currency,
    })}`;

  if (state.status === "loading" || state.status === "error" || !state.chain) {
    return (
      <main className="financial-state">
        <h1>Histórico de correções</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando histórico de correções…"
            : state.notice}
        </p>
        {state.status !== "loading" && (
          <button onClick={state.retry}>Tentar novamente</button>
        )}
        <Link href={backToHistory}>Voltar aos lançamentos</Link>
      </main>
    );
  }

  const { chain } = state;

  return (
    <main className="dashboard correction-history-page">
      <aside className="dashboard-sidebar">
        <Link
          href={`/inicio?${new URLSearchParams({ household })}`}
          className="dashboard-brand"
        >
          <BrandLogo />
        </Link>
        <nav aria-label="Navegação principal">
          <Link href={`/inicio?${new URLSearchParams({ household })}`}>
            Início
          </Link>
          <Link href={backToHistory} aria-current="page">
            Lançamentos
          </Link>
          <Link
            href={`/composicao-saldo?${new URLSearchParams({ household })}`}
          >
            Contas
          </Link>
          <Link
            href={`/resumo-categorias?${new URLSearchParams({ household })}`}
          >
            Categorias
          </Link>
        </nav>
        <div className="sidebar-quote-card">
          <p>Pequenas escolhas constroem grandes ninhos.</p>
        </div>
      </aside>

      <div className="correction-history-content">
        <header className="correction-hero-header">
          <div className="correction-hero-copy">
            <nav
              className="correction-breadcrumb"
              aria-label="Trilha de navegação"
            >
              <Link href={backToHistory}>+ Lançamentos</Link>
              <span className="breadcrumb-separator">/</span>
              <span>Histórico de correções</span>
            </nav>
            <h1>Histórico de correções</h1>
            <p>Acompanhe os vínculos e as alterações deste lançamento.</p>
          </div>
          <div className="correction-hero-artwork">
            <Image
              src="/images/pipo-correction-history.webp"
              alt="Pipo demonstrando os vínculos de correção"
              width={340}
              height={220}
              priority
            />
          </div>
        </header>

        <section
          className="correction-timeline"
          aria-label="Linha do tempo de correções"
        >
          {chain.steps.map((step, idx) => {
            const isOriginal = step.kind === "original";
            const isReversal = step.kind === "reversal";
            const signedAmount =
              step.detail.amount < 0
                ? `- ${money(Math.abs(step.detail.amount), step.detail.currency)}`
                : `+ ${money(step.detail.amount, step.detail.currency)}`;

            const categoryRow = step.detail.rows.find(
              (r) => r.label === "Categoria",
            );
            const subcategoryRow = step.detail.rows.find(
              (r) => r.label === "Subcategoria",
            );
            const accountName =
              step.detail.postings[0]?.accountName || "Conta principal";

            return (
              <div
                key={step.detail.id}
                className={`correction-timeline-step step-${step.step}`}
              >
                <div className="correction-step-marker-col">
                  <div className={`correction-step-badge marker-${step.step}`}>
                    {step.step}
                  </div>
                  {idx < chain.steps.length - 1 && (
                    <div className="correction-step-line" />
                  )}
                </div>

                <div className="correction-step-body">
                  <h2 className="correction-step-title">{step.title}</h2>
                  <div
                    className={`correction-card ${isOriginal ? "card-original" : isReversal ? "card-reversal" : "card-substitute"}`}
                  >
                    <div className="correction-card-left">
                      <div
                        className={`correction-icon-wrapper icon-step-${step.step}`}
                      >
                        <StepIcon step={step} />
                      </div>
                      <div className="correction-card-info">
                        <div className="correction-title-row">
                          <strong className="correction-record-title">
                            {isReversal
                              ? "Compensação do lançamento original"
                              : step.detail.description}
                          </strong>
                          {!isReversal && (
                            <span
                              className={`correction-flow-tag ${step.detail.kind}`}
                            >
                              {step.detail.kind === "expense"
                                ? "Saída"
                                : step.detail.kind === "income"
                                  ? "Entrada"
                                  : "Transferência"}
                            </span>
                          )}
                        </div>

                        {isReversal ? (
                          <p className="correction-meta-subtitle">
                            {step.reason ||
                              "Motivo: valor informado incorretamente."}
                          </p>
                        ) : (
                          <p className="correction-meta-subtitle">
                            {accountName}
                            {categoryRow && ` · ${categoryRow.value}`}
                            {subcategoryRow && ` > ${subcategoryRow.value}`}
                          </p>
                        )}

                        <div className="correction-audit-line">
                          <User size={15} />
                          <span>
                            {step.detail.createdBy || "Daniel Yudi"} ·{" "}
                            {formatAuditDate(step.detail.postedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="correction-card-right">
                      <strong
                        className={`correction-amount ${step.detail.amount < 0 ? "amount-out" : "amount-in"}`}
                      >
                        {signedAmount}
                      </strong>
                      <span
                        className={`correction-status-pill ${step.statusBadge === "Estornado" ? "pill-reversed" : "pill-registered"}`}
                      >
                        {step.statusBadge}
                      </span>
                      <Link
                        className="correction-action-link"
                        href={target(step.detail.id)}
                      >
                        <Eye size={16} />
                        <span>
                          Ver{" "}
                          {isOriginal
                            ? "original"
                            : isReversal
                              ? "estorno"
                              : "substituição"}
                        </span>
                      </Link>
                    </div>
                  </div>

                  {step.note && (
                    <div className="correction-step-footnote">
                      <p>{step.note}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section
          className="correction-summary-banner"
          aria-label="Resumo do efeito da cadeia de correções"
        >
          <div className="correction-summary-info">
            <Info size={22} weight="fill" />
            <p>
              {chain.hasSubstitute
                ? "A substituição é um novo lançamento vinculado. Os registros anteriores permanecem no histórico."
                : "O estorno é uma movimentação de compensação vinculada. Os registros anteriores permanecem no histórico."}
            </p>
          </div>
          <div className="correction-summary-divider" />
          <div className="correction-summary-net">
            <Coins size={24} weight="fill" />
            <p>
              Efeito final desta cadeia: <strong>{chain.netLabel}</strong>.
            </p>
          </div>
        </section>

        <footer className="correction-footer">
          <Link className="correction-back-button" href={target(transactionId)}>
            <ArrowLeft size={18} />
            <span>Voltar ao lançamento</span>
          </Link>
        </footer>
      </div>
    </main>
  );
}
