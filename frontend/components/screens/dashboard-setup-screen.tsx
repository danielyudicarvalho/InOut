"use client";
import { BrandLogo } from "../ui/brand-logo";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { House, Wallet, Plus, Receipt } from "@phosphor-icons/react";
import { money, type Home, type Household } from "@inout/finance";
import { NewRecordPicker } from "../financial/records/new-record-picker";
export function DashboardSetupScreen({
  mode,
  data,
  households,
  householdId,
  period,
  currency,
  onCurrency,
  onHousehold,
  onRefresh,
}: {
  mode: "no-accounts" | "no-movements";
  data: Home;
  households: Household[];
  householdId: string;
  period: string;
  currency: string;
  onCurrency: (value: string) => void;
  onHousehold: (value: string) => void;
  onRefresh: () => void;
}) {
  const [recordOpen, setRecordOpen] = useState(false);
  const none = mode === "no-accounts",
    codes = [...new Set(data.setupAccounts.map((a) => a.currency))],
    code = codes.includes(currency) ? currency : (codes[0] ?? "BRL"),
    context = { household: householdId, period, currency: code };
  const accountHref = `/configuracao-inicial?${new URLSearchParams(context)}`,
    homeHref = `/inicio?${new URLSearchParams(context)}`;
  return (
    <main
      className={`dashboard setup-dashboard ${none ? "setup-no-accounts" : "setup-no-movements"}`}
    >
      <aside className="dashboard-sidebar">
        <Link href={homeHref} className="dashboard-brand">
          <BrandLogo />
        </Link>
        <small>Finanças para o seu lar</small>
        <nav aria-label="Navegação principal">
          <Link
            className="income-nav-link"
            href={`/lancamentos?${new URLSearchParams(context)}`}
          >
            <Receipt size={21} />
            Lançamentos
          </Link>
          <Link
            className="income-nav-link income-nav-current"
            aria-current="page"
            href={homeHref}
          >
            <House size={21} />
            Início
          </Link>
          <Link
            className="income-nav-link"
            href={
              none
                ? accountHref
                : `/composicao-saldo?${new URLSearchParams(context)}`
            }
          >
            <Wallet size={21} />
            Contas
          </Link>
        </nav>
        <p className="dashboard-motto">
          Um lar bem cuidado hoje,
          <br />
          um amanhã melhor. ♥
        </p>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <label>
            <House size={18} aria-hidden="true" />
            <span className="sr-only">Residência atual</span>
            <select
              aria-label="Residência atual"
              value={householdId}
              onChange={(e) => onHousehold(e.target.value)}
            >
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <button className="dashboard-text" onClick={onRefresh}>
            Atualizar
          </button>
        </header>
        {!data.isReconciled ? (
          <p role="alert" className="dashboard-reconciliation">
            Há uma divergência na conciliação. Atualize os dados antes de usar
            seus saldos.
          </p>
        ) : null}
        <section className="setup-hero">
          <div className="setup-copy">
            <h1>
              {none
                ? "Vamos preparar seu Ninho?"
                : "Seu Ninho está pronto para começar"}
            </h1>
            <p>
              {none
                ? "Crie uma conta financeira para organizar o dinheiro do seu lar."
                : "Você já tem uma conta. Agora registre sua primeira entrada ou saída."}
            </p>
            {none ? (
              <>
                <Link className="primary setup-create" href={accountHref}>
                  Criar conta financeira
                </Link>
                <small>
                  Pode ser sua carteira, conta corrente ou poupança.
                </small>
                <p className="setup-hint">
                  ⓘ Conta financeira é onde seu dinheiro fica.
                </p>
              </>
            ) : (
              <>
                {codes.length > 1 ? (
                  <label className="setup-currency">
                    Moeda do novo registro
                    <select
                      value={code}
                      onChange={(e) => onCurrency(e.target.value)}
                    >
                      {codes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="setup-account-list">
                  {data.setupAccounts.map((a) => (
                    <article className="setup-account" key={a.id}>
                      <Wallet size={24} aria-hidden="true" />
                      <div>
                        <b>{a.name}</b>
                        <p>
                          {a.initialBalance === null
                            ? "Saldo atual"
                            : "Saldo inicial"}
                          :{" "}
                          <strong>
                            {money(a.initialBalance ?? a.balance, a.currency)}
                          </strong>
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="setup-actions">
                  <Link
                    className="primary"
                    href={`/novo-registro?${new URLSearchParams({ ...context, kind: "income" })}`}
                  >
                    ⊕ Registrar entrada
                  </Link>
                  <Link
                    className="setup-expense-action"
                    href={`/novo-registro?${new URLSearchParams({ ...context, kind: "expense" })}`}
                  >
                    ⊖ Registrar saída
                  </Link>
                </div>
                <p className="setup-hint">
                  ⓘ O saldo inicial é o dinheiro que você já tinha.
                </p>
              </>
            )}
          </div>
          <Image
            src={
              none
                ? "/images/pipo-empty-accounts.webp"
                : "/images/pipo-first-movement.webp"
            }
            width={1000}
            height={500}
            sizes="(max-width: 760px) 90vw, 50vw"
            alt={
              none
                ? "Pipo preparando um ninho ao lado de um caderno vazio"
                : "Pipo com um caderno ao lado de uma casinha"
            }
            preload
            className="setup-art"
          />
        </section>
        {!none ? (
          <section
            className="setup-recent"
            aria-labelledby="setup-recent-title"
          >
            <h2 id="setup-recent-title">Movimentações recentes</h2>
            <div className="setup-empty-list">
              <Receipt size={30} aria-hidden="true" />
              <strong>Nenhuma movimentação registrada</strong>
              <p>
                Registre sua primeira entrada ou saída para ver suas
                movimentações aqui.
              </p>
            </div>
          </section>
        ) : null}
        <nav className="dashboard-bottom-nav" aria-label="Navegação mobile">
          <Link href={homeHref} aria-current="page">
            <House size={23} />
            Início
          </Link>
          {!none ? (
            <button onClick={() => setRecordOpen(true)} aria-haspopup="dialog">
              <Plus size={23} />
              Registrar
            </button>
          ) : null}
          <Link
            href={
              none
                ? accountHref
                : `/composicao-saldo?${new URLSearchParams(context)}`
            }
          >
            <Wallet size={23} />
            Contas
          </Link>
        </nav>
      </div>
      {recordOpen ? (
        <NewRecordPicker
          household={householdId}
          period={period}
          currency={code}
          onClose={() => setRecordOpen(false)}
        />
      ) : null}
    </main>
  );
}
