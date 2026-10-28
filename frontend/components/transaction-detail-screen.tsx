"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { canReverse, money, historyKind, displayDate } from "@inout/finance";
import { BrandLogo } from "./brand-logo";
import { DateSelector } from "./auxiliary-selector";
import { useReversal } from "../lib/finance/use-reversal";
export function TransactionDetailScreen() {
  const p = useSearchParams(),
    household = p.get("household") ?? "",
    id = p.get("transaction") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "";
  return (
    <DetailView
      key={`${household}:${id}`}
      household={household}
      id={id}
      period={period}
      currency={currency}
    />
  );
}
function DetailView({
  household,
  id,
  period,
  currency,
}: {
  household: string;
  id: string;
  period: string;
  currency: string;
}) {
  const state = useReversal(household, id),
    [confirm, setConfirm] = useState(false),
    [dismissed, setDismissed] = useState(false);
  const back = `/lancamentos?${new URLSearchParams({ household, ...(period ? { period } : {}), currency: state.options?.currency ?? currency })}`;
  if (state.status === "loading" || state.status === "error" || !state.options)
    return (
      <main className="financial-state">
        <h1>Detalhe do lançamento</h1>
        <p role="status">
          {state.status === "loading" ? "Carregando lançamento…" : state.notice}
        </p>
        {state.status !== "loading" && (
          <button onClick={state.retry}>Tentar novamente</button>
        )}
        <Link href={back}>Voltar ao histórico</Link>
      </main>
    );
  const detail = state.options,
    done = state.status === "success",
    pending = state.status === "uncertain",
    saving = state.status === "saving",
    reversed = done || detail.status === "reversed";
  const target = (transaction: string) =>
    `/lancamento?${new URLSearchParams({ household, transaction, ...(period ? { period } : {}), currency: state.options?.currency ?? currency })}`;
  return (
    <main className="dashboard transaction-page">
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
          <Link href={back} aria-current="page">
            Lançamentos
          </Link>
          <Link
            href={`/composicao-saldo?${new URLSearchParams({ household })}`}
          >
            Contas
          </Link>
        </nav>
      </aside>
      <div className="transaction-content">
        <header className="transaction-hero">
          <div>
            <Link href={back}>‹ Lançamentos</Link>
            <h1>Detalhe do lançamento</h1>
            <p>Confira abaixo todas as informações deste lançamento.</p>
          </div>
          <Image
            src="/images/pipo-detail.webp"
            alt=""
            width={300}
            height={160}
          />
        </header>
        <section className="transaction-card">
          <div className="transaction-summary">
            <div>
              <h2>{detail.description}</h2>
              <small>{historyKind({ kind: detail.kind })}</small>
              <strong
                className={
                  detail.amount < 0 ? "transaction-out" : "transaction-in"
                }
                style={{ textDecoration: reversed ? "line-through" : "none" }}
              >
                {money(detail.amount, detail.currency)}
              </strong>
            </div>
            <span
              className={
                reversed ? "transaction-status reversed" : "transaction-status"
              }
            >
              {reversed ? "Estornado" : "Registrado"}
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
          {detail.postings.length > 1 && (
            <p className="transaction-help">
              Movimentação entre contas: o valor não é receita ou despesa.
            </p>
          )}
          {detail.reversalOf && (
            <Link href={target(detail.reversalOf)}>
              Ver lançamento original deste estorno
            </Link>
          )}
        </section>
        <section className="transaction-card">
          <h2>Registro</h2>
          <p className="transaction-help">
            Informações de auditoria deste lançamento.
          </p>
          <dl className="transaction-audit">
            <div>
              <dt>Registrado por (usuário)</dt>
              <dd>{detail.createdBy}</dd>
            </div>
            <div>
              <dt>Registrado em</dt>
              <dd>
                {new Date(detail.postedAt).toLocaleString("pt-BR")}{" "}
                <small>(horário do dispositivo)</small>
              </dd>
            </div>
            <div>
              <dt>Identificador</dt>
              <dd>{detail.id}</dd>
            </div>
          </dl>
        </section>
        {state.notice && (
          <p role={done ? "status" : "alert"}>
            {done
              ? "Estorno registrado com sucesso. O registro original foi mantido."
              : state.notice}
          </p>
        )}
        {done && state.result && (
          <Link href={target(state.result.transactionId)}>
            Ver movimentação de estorno
          </Link>
        )}
        <footer className="transaction-actions">
          <Link className="primary" href={back}>
            ← Voltar ao histórico
          </Link>
          {!done && (canReverse(detail) || pending) && (
            <button
              className="transaction-reverse"
              onClick={() => {
                setConfirm(true);
                setDismissed(false);
              }}
            >
              ↶ {pending ? "Verificar estorno pendente" : "Estornar lançamento"}
            </button>
          )}
          <button onClick={state.retry}>Atualizar</button>
        </footer>
        <p className="transaction-help">
          O estorno mantém o registro original e cria uma movimentação de
          compensação.
        </p>
      </div>
      {!done &&
        (canReverse(detail) || pending || saving) &&
        (confirm || (pending && !dismissed) || saving) && (
          <ReversalDialog
            date={state.fields.date}
            description={state.fields.description}
            pending={pending}
            saving={saving}
            notice={state.notice}
            onEdit={state.edit}
            onClose={() => {
              setConfirm(false);
              setDismissed(true);
            }}
            onConfirm={() => void state.submit()}
          />
        )}
    </main>
  );
}
function ReversalDialog({
  date,
  description,
  pending,
  saving,
  notice,
  onEdit,
  onClose,
  onConfirm,
}: {
  date: string;
  description: string;
  pending: boolean;
  saving: boolean;
  notice: string;
  onEdit: (field: "date" | "description", value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="aux-dialog"
      aria-labelledby="reversal-title"
      onCancel={(e) => {
        if (saving) e.preventDefault();
        else onClose();
      }}
    >
      <div className="aux-content">
        <header>
          <strong id="reversal-title">
            {pending ? "Estorno com confirmação pendente" : "Confirmar estorno"}
          </strong>
          {!saving && (
            <button
              type="button"
              aria-label="Fechar confirmação"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </header>
        <p>
          O original será mantido. Uma nova movimentação compensará o valor em
          todas as contas envolvidas.
        </p>
        {notice && <p role="alert">{notice}</p>}
        <label>
          Data do estorno
          <DateSelector
            value={date}
            disabled={pending || saving}
            onChange={(value) => onEdit("date", value)}
          />
        </label>
        <label>
          Descrição (opcional)
          <textarea
            maxLength={500}
            disabled={pending || saving}
            value={description}
            onChange={(e) => onEdit("description", e.target.value)}
          />
        </label>
        <small>Data selecionada: {displayDate(date)}</small>
        <footer>
          {!saving && (
            <button type="button" onClick={onClose}>
              {pending ? "Fechar sem descartar a tentativa" : "Cancelar"}
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving
              ? "Estornando…"
              : pending
                ? "Verificar mesma tentativa"
                : "Confirmar estorno"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
