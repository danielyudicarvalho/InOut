"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarBlank,
  CheckCircle,
  CreditCard,
  FileText,
  Info,
  Tag,
  TrendDown,
  TrendUp,
  User,
  Clock,
} from "@phosphor-icons/react";
import { money, displayDate } from "@inout/finance";
import { BrandLogo } from "../ui/brand-logo";
import { useDuplicateResolution } from "../../lib/finance/use-duplicate-resolution";

export function DuplicateResolutionScreen() {
  const p = useSearchParams();
  const household = p.get("household") ?? "";
  const firstId = p.get("first") ?? p.get("t1") ?? p.get("transaction") ?? "";
  const secondId = p.get("second") ?? p.get("t2") ?? "";
  const period = p.get("period") ?? "";
  const currency = p.get("currency") ?? "";

  return (
    <DuplicateResolutionView
      key={`${household}:${firstId}:${secondId}`}
      household={household}
      firstId={firstId}
      secondId={secondId}
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

function DuplicateResolutionView({
  household,
  firstId,
  secondId,
  period,
  currency,
}: {
  household: string;
  firstId: string;
  secondId: string;
  period: string;
  currency: string;
}) {
  const router = useRouter();
  const state = useDuplicateResolution(household, firstId, secondId);

  const backToHistory = `/lancamentos?${new URLSearchParams({
    household,
    ...(period ? { period } : {}),
    ...(currency ? { currency } : {}),
  })}`;

  if (
    state.status === "loading" ||
    state.status === "error" ||
    !state.comparison
  ) {
    return (
      <main className="financial-state">
        <h1>Resolver duplicidade</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando registros para comparação…"
            : state.notice}
        </p>
        {state.status !== "loading" && (
          <button onClick={state.retry}>Tentar novamente</button>
        )}
        <Link href={backToHistory}>Voltar aos lançamentos</Link>
      </main>
    );
  }

  const { comparison, selectedId } = state;
  const records = [comparison.first, comparison.second];
  const selectedRecord =
    records.find((r) => r.id === selectedId) || comparison.second;

  const handleReviewReversal = () => {
    router.push(
      `/lancamento?${new URLSearchParams({
        household,
        transaction: selectedRecord.id,
        ...(period ? { period } : {}),
        currency: selectedRecord.currency,
        action: "reverse",
      })}`,
    );
  };

  return (
    <main className="dashboard duplicate-page">
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
          <p>Sonhos também moram aqui.</p>
        </div>
      </aside>

      <div className="duplicate-content">
        <header className="duplicate-hero-header">
          <div className="duplicate-hero-copy">
            <nav
              className="duplicate-breadcrumb"
              aria-label="Trilha de navegação"
            >
              <Link href={backToHistory}>Lançamentos</Link>
              <span className="breadcrumb-separator">/</span>
              <span>Resolver duplicidade</span>
            </nav>
            <h1>Resolver duplicidade</h1>
            <p>Compare os registros e escolha qual deve ser estornado.</p>
          </div>
          <div className="duplicate-hero-artwork">
            <Image
              src="/images/pipo-duplicates.webp"
              alt="Pipo inspecionando recibos duplicados"
              width={310}
              height={205}
              priority
            />
          </div>
        </header>

        <div className="duplicate-info-notice" role="status">
          <Info size={19} weight="bold" />
          <span>Registros selecionados manualmente para comparação.</span>
        </div>

        <section
          className="duplicate-comparison-grid"
          aria-label="Comparação de registros duplicados"
        >
          {records.map((record) => {
            const isSelected = record.id === selectedId;
            const categoryText = [record.categoryName, record.subcategoryName]
              .filter(Boolean)
              .join(" › ");

            return (
              <div
                key={record.id}
                className={`duplicate-card ${isSelected ? "selected" : ""}`}
                onClick={() => state.select(record.id)}
              >
                <div className="duplicate-card-selector">
                  <span
                    className={`duplicate-radio ${isSelected ? "checked" : ""}`}
                    aria-hidden="true"
                  >
                    {isSelected ? "◉" : "○"}
                  </span>
                  <span className="duplicate-radio-label">
                    {isSelected
                      ? "Selecionado para estorno"
                      : "Selecionar para estorno"}
                  </span>
                </div>

                <div className="duplicate-card-body">
                  <div className="duplicate-record-header">
                    <FileText size={20} className="duplicate-file-icon" />
                    <strong className="duplicate-record-title">
                      {record.description}
                    </strong>
                  </div>

                  <div className="duplicate-row duplicate-flow-row">
                    {record.kind === "expense" ? (
                      <TrendDown size={18} className="flow-icon-expense" />
                    ) : (
                      <TrendUp size={18} className="flow-icon-income" />
                    )}
                    <span className="duplicate-flow-text">
                      {record.kind === "expense"
                        ? "Saída"
                        : record.kind === "income"
                          ? "Entrada"
                          : "Transferência"}
                    </span>
                  </div>

                  <div className="duplicate-row duplicate-amount-row">
                    <span className="duplicate-amount-tag">
                      {money(Math.abs(record.amount), record.currency)}
                    </span>
                  </div>

                  <div className="duplicate-row">
                    <CreditCard size={18} />
                    <span>{record.accountName}</span>
                  </div>

                  {categoryText && (
                    <div className="duplicate-row">
                      <Tag size={18} />
                      <span>{categoryText}</span>
                    </div>
                  )}

                  <div className="duplicate-row">
                    <CalendarBlank size={18} />
                    <span>{displayDate(record.date)}</span>
                  </div>

                  <div className="duplicate-row duplicate-status-row">
                    <CheckCircle size={18} weight="fill" />
                    <span className="duplicate-status-text">
                      {record.status}
                    </span>
                  </div>

                  <hr className="duplicate-card-divider" />

                  <dl className="duplicate-audit-list">
                    <div className="duplicate-audit-item">
                      <dt># Identificador</dt>
                      <dd>{record.displayId}</dd>
                    </div>
                    <div className="duplicate-audit-item">
                      <dt>
                        <User size={14} /> Criado por
                      </dt>
                      <dd>{record.createdBy || "Usuário"}</dd>
                    </div>
                    <div className="duplicate-audit-item">
                      <dt>
                        <Clock size={14} /> Criado em
                      </dt>
                      <dd>{formatAuditDate(record.postedAt)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            );
          })}
        </section>

        <footer
          className="duplicate-confirmation-bar"
          aria-label="Confirmação de seleção de estorno"
        >
          <div className="duplicate-confirmation-left">
            <div className="duplicate-check-icon">
              <CheckCircle size={26} weight="fill" />
            </div>
            <div className="duplicate-confirmation-copy">
              <strong>
                Você selecionou {selectedRecord.displayId} para estorno.
              </strong>
              <p>
                O outro registro será mantido. Você revisará o estorno antes de
                confirmar.
              </p>
            </div>
          </div>

          <div className="duplicate-confirmation-actions">
            <Link className="duplicate-cancel-btn" href={backToHistory}>
              Cancelar
            </Link>
            <button
              className="duplicate-review-btn"
              onClick={handleReviewReversal}
            >
              Revisar estorno
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
