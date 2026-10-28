"use client";
import { ClassificationDialog } from "./classification-dialog";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Wallet, Users } from "@phosphor-icons/react";
import { canReverse, money, historyKind } from "@inout/finance";
import { BrandLogo } from "./brand-logo";
import { ReversalDialog } from "./reversal-dialog";
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
    [classify, setClassify] = useState(false),
    [corrected, setCorrected] = useState(false),
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
    reversed = done || detail.status === "reversed",
    transfer = detail.kind === "transfer",
    opening = detail.kind === "openingbalance";
  const target = (transaction: string) =>
    `/lancamento?${new URLSearchParams({ household, transaction, ...(period ? { period } : {}), currency: state.options?.currency ?? currency })}`;
  return (
    <main
      className={`dashboard transaction-page ${transfer ? "transfer-detail-page" : opening ? "opening-detail-page" : ""}`}
    >
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
            <h1>
              {transfer
                ? "Detalhe da transferência"
                : opening
                  ? "Detalhe do saldo inicial"
                  : "Detalhe do lançamento"}
            </h1>
            {!transfer && (
              <p>
                {opening
                  ? "O ponto de partida da sua conta."
                  : "Confira abaixo todas as informações deste lançamento."}
              </p>
            )}
          </div>
          {!transfer && !opening && (
            <Image
              src="/images/pipo-detail.webp"
              alt=""
              width={300}
              height={160}
            />
          )}
        </header>
        <section className="transaction-card">
          <div className="transaction-summary">
            <div>
              <h2>{opening ? "Saldo inicial da conta" : detail.description}</h2>
              <small>
                {transfer && <span aria-hidden="true">⇄ </span>}
                {opening
                  ? "Posição inicial"
                  : historyKind({ kind: detail.kind })}
              </small>
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
          {transfer && (
            <>
              <Image
                className="transfer-detail-art"
                src="/images/pipo-transfer-detail.webp"
                alt=""
                width={350}
                height={190}
              />
              <div
                className="transfer-accounts"
                aria-label="Contas da transferência"
              >
                {detail.postings.map((posting, i) => (
                  <div
                    key={posting.accountId}
                    className={
                      i === 0 ? "transfer-origin" : "transfer-destination"
                    }
                  >
                    <span aria-hidden="true" className="transfer-account-icon">
                      {i === 0 ? <Wallet size={28} /> : <Users size={28} />}
                    </span>
                    <div>
                      <small>{i === 0 ? "Origem" : "Destino"}</small>
                      <strong>{posting.accountName}</strong>
                      <small>{posting.currency}</small>
                    </div>
                    {i === 0 && (
                      <span
                        className="transfer-account-arrow"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {opening && (
            <Image
              className="opening-detail-art"
              src="/images/pipo-opening-detail.webp"
              alt=""
              width={350}
              height={270}
            />
          )}
          <dl className="transaction-fields">
            {(transfer ? detail.rows.slice(2) : detail.rows).map((row, i) => (
              <div key={i}>
                <dt>
                  {transfer && row.label === "Data do lançamento"
                    ? "Data da transferência"
                    : opening && row.label === "Data do lançamento"
                      ? "Data de referência"
                      : opening && i === 0
                        ? "Conta"
                        : row.label}
                </dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          {detail.postings.length > 1 && (
            <p className="transaction-help">
              Esta transferência move dinheiro entre suas contas e não altera o
              resultado do período.
            </p>
          )}
          {detail.reversalOf && (
            <Link href={target(detail.reversalOf)}>
              Ver lançamento original deste estorno
            </Link>
          )}
        </section>
        {opening && (
          <aside
            className="opening-detail-notice"
            aria-label="Sobre o saldo inicial"
          >
            <strong>Saldo inicial não é receita</strong>
            <p>
              Representa o dinheiro que já existia na conta na data de
              referência. Compõe o saldo, mas não entra nas receitas nem no
              resultado do período.
            </p>
            <small>Não é um lançamento recorrente.</small>
          </aside>
        )}
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
        {corrected && (
          <p role="status">Classificação atualizada com sucesso.</p>
        )}
        <footer className="transaction-actions">
          {opening && (
            <Link
              className="primary"
              href={`/composicao-saldo?${new URLSearchParams({ household, account: detail.postings[0].accountId, currency: detail.currency, ...(period ? { period } : {}) })}`}
            >
              ↗ Ver conta
            </Link>
          )}
          <Link className={opening ? undefined : "primary"} href={back}>
            ← Voltar ao histórico
          </Link>
          {!done && ((!opening && canReverse(detail)) || pending) && (
            <button
              className="transaction-reverse"
              onClick={() => {
                setConfirm(true);
                setDismissed(false);
              }}
            >
              ↶{" "}
              {pending
                ? "Verificar estorno pendente"
                : transfer
                  ? "Estornar transferência"
                  : "Estornar lançamento"}
            </button>
          )}
          {["income", "expense"].includes(detail.kind) && (
            <button onClick={() => setClassify(true)}>
              {detail.status === "posted"
                ? "Corrigir classificação"
                : "Consultar classificação"}
            </button>
          )}
          <button onClick={state.retry}>Atualizar</button>
        </footer>
        {!opening && (
          <p className="transaction-help">
            {transfer
              ? "O estorno desfaz os dois lados da transferência em uma única operação, mantendo o registro original."
              : "O estorno mantém o registro original e cria uma movimentação de compensação."}
          </p>
        )}
      </div>
      {classify && (
        <ClassificationDialog
          household={household}
          transactionId={id}
          onClose={() => setClassify(false)}
          onSaved={() => {
            setClassify(false);
            setCorrected(true);
            state.retry();
          }}
        />
      )}
      {!done &&
        ((!opening && canReverse(detail)) || pending || saving) &&
        (confirm || (pending && !dismissed) || saving) && (
          <ReversalDialog
            detail={detail}
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
