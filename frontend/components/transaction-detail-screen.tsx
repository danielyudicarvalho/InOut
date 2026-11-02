"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowsClockwise, WarningCircle } from "@phosphor-icons/react";
import {
  canCorrectClassification,
  historyKind,
  money,
  type TransactionDetail,
} from "@inout/finance";
import { useTransactionDetail } from "../lib/finance/use-transaction-detail";
import { ClassificationDialog } from "./classification-dialog";
import { TransactionConflictDialog } from "./transaction-conflict-dialog";
import "./transaction-detail.css";
export function TransactionDetailScreen() {
  const params = useSearchParams(),
    household = params.get("household") ?? "",
    transaction = params.get("transaction") ?? "";
  return (
    <Detail
      key={`${household}:${transaction}`}
      household={household}
      transaction={transaction}
      period={params.get("period") ?? ""}
    />
  );
}
function Detail({
  household,
  transaction,
  period,
}: {
  household: string;
  transaction: string;
  period: string;
}) {
  const state = useTransactionDetail(household, transaction);
  const [editing, setEditing] = useState(false),
    [conflict, setConflict] = useState<TransactionDetail | null>(null),
    [blocked, setBlocked] = useState(false),
    [conflictOpen, setConflictOpen] = useState(false),
    [saved, setSaved] = useState(false);
  const detail = state.detail,
    query = new URLSearchParams({ household, ...(period ? { period } : {}) });
  const back = `/lancamentos?${query}`;
  const target = (id: string) =>
    `/lancamento?${query}&transaction=${encodeURIComponent(id)}`;
  async function reload() {
    setEditing(false);
    if (await state.reload()) {
      setBlocked(false);
      setConflictOpen(false);
      setConflict(null);
    }
  }
  function changed(snapshot: TransactionDetail) {
    setEditing(false);
    setConflict(snapshot);
    setBlocked(true);
    setConflictOpen(true);
    setSaved(false);
  }
  return (
    <main className="dashboard transaction-page">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href={`/inicio?${query}`}>
          🌿 Ninho
        </Link>
        <nav aria-label="Navegação principal">
          <Link href={`/inicio?${query}`}>Início</Link>
          <Link href={back} aria-current="page">
            Lançamentos
          </Link>
          <Link href={`/composicao-saldo?${query}`}>Contas</Link>
        </nav>
      </aside>
      <div className="transaction-content">
        <header className="transaction-header">
          <div>
            <Link href={back}>‹ Voltar</Link>
            <h1>Lançamento</h1>
          </div>
          {state.refreshed && (
            <span role="status" className="transaction-refreshed">
              <ArrowsClockwise size={17} /> Dados atualizados
            </span>
          )}
        </header>
        {state.status === "loading" && (
          <p role="status">Carregando lançamento…</p>
        )}
        {state.status === "error" && (
          <div role="alert">
            <p>{state.notice}</p>
            <button
              className="transaction-primary"
              onClick={() => void reload()}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {saved && <p role="status">Classificação salva com sucesso.</p>}
        {detail && (
          <>
            <section className="transaction-card">
              <div className="transaction-summary">
                <span
                  aria-hidden="true"
                  className={`transaction-icon ${detail.amount < 0 ? "out" : "in"}`}
                >
                  {detail.kind === "transfer"
                    ? "⇄"
                    : detail.amount < 0
                      ? "↓"
                      : "↑"}
                </span>
                <div>
                  <h2>{detail.description}</h2>
                  <strong
                    className={`${detail.amount < 0 ? "transaction-out" : "transaction-in"} ${detail.status === "reversed" ? "transaction-crossed" : ""}`}
                  >
                    {historyKind(detail)} ·{" "}
                    {money(detail.amount, detail.currency)}
                  </strong>
                  <small>
                    {detail.postings.map((p) => p.accountName).join(" → ")}
                  </small>
                </div>
                <span
                  className={`transaction-status ${detail.status === "reversed" ? "reversed" : ""}`}
                >
                  {detail.status === "reversed" ? "Estornado" : "Registrado"}
                </span>
              </div>
              <dl className="transaction-fields">
                {detail.rows.map((row, i) => (
                  <div key={i}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              {detail.status === "reversed" && (
                <div className="transaction-reversed-banner">
                  <WarningCircle size={24} weight="fill" aria-hidden="true" />
                  <p>
                    <strong>Este lançamento já foi estornado.</strong>
                    <small>
                      Você pode consultar a movimentação de compensação.
                    </small>
                  </p>
                  {detail.reversalId && (
                    <Link
                      className="transaction-primary"
                      href={target(detail.reversalId)}
                    >
                      Ver estorno
                    </Link>
                  )}
                  <Link className="transaction-secondary" href={back}>
                    Voltar ao histórico
                  </Link>
                </div>
              )}
              {blocked && (
                <div className="transaction-warning" role="alert">
                  <WarningCircle size={22} />
                  <span>
                    Este lançamento mudou. Recarregue os dados antes de
                    continuar.
                  </span>
                  <button
                    onClick={() => {
                      setConflictOpen(true);
                    }}
                  >
                    Ver aviso
                  </button>
                </div>
              )}
              {detail.reversalOf && (
                <Link
                  className="transaction-secondary"
                  href={target(detail.reversalOf)}
                >
                  Ver lançamento original
                </Link>
              )}
            </section>
            <section className="transaction-card">
              <h2>Histórico disponível</h2>
              <dl className="transaction-fields">
                <div>
                  <dt>Registrado por (usuário)</dt>
                  <dd>{detail.createdBy}</dd>
                </div>
                <div>
                  <dt>Registrado em</dt>
                  <dd>
                    {new Date(detail.postedAt).toLocaleString("pt-BR")} (horário
                    do dispositivo)
                  </dd>
                </div>
                <div>
                  <dt>Identificador</dt>
                  <dd>{detail.id}</dd>
                </div>
              </dl>
              <p className="transaction-help">
                A autoria e a data de cada movimentação podem ser consultadas no
                respectivo detalhe.
              </p>
            </section>
            <footer className="transaction-actions">
              {canCorrectClassification(detail) && !blocked && (
                <button
                  className="transaction-primary"
                  onClick={() => setEditing(true)}
                >
                  Corrigir classificação
                </button>
              )}
              <button
                className="transaction-secondary"
                onClick={() => void reload()}
              >
                <ArrowsClockwise size={18} /> Recarregar dados
              </button>
              <Link className="transaction-secondary" href={back}>
                Voltar ao histórico
              </Link>
            </footer>
          </>
        )}
        {!detail && state.status !== "loading" && (
          <Link href={back}>Voltar ao histórico</Link>
        )}
      </div>
      {editing && (
        <ClassificationDialog
          household={household}
          transactionId={transaction}
          onClose={() => setEditing(false)}
          onConflict={changed}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
            void reload();
          }}
        />
      )}
      {conflictOpen && conflict && (
        <TransactionConflictDialog
          detail={conflict}
          busy={state.status === "loading"}
          error={state.status === "error" ? state.notice : ""}
          back={back}
          onReload={() => void reload()}
          onClose={() => setConflictOpen(false)}
        />
      )}
    </main>
  );
}
