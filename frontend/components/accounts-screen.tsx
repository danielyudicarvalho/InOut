"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { accountKindLabel, money } from "@inout/finance";
import { groupAccounts, type ManagedAccount } from "@inout/finance/accounts";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import { useAccounts } from "../lib/finance/use-accounts";
import "./accounts.css";
const kinds = [
  ["checking", "Conta corrente"],
  ["cash", "Carteira"],
  ["savings", "Poupança"],
  ["investment", "Investimento"],
  ["other", "Outro"],
];
export function AccountsScreen() {
  const p = useSearchParams();
  const home = useFinancialHome({
    initialHouseholdId: p.get("household") ?? "",
    initialPeriod: p.get("period") ?? "",
  });
  if (home.status !== "ready")
    return (
      <main className="financial-state">
        <h1>Minhas contas</h1>
        <p role="status">
          {home.status === "loading"
            ? "Carregando residência…"
            : home.notice || "Escolha uma residência para consultar as contas."}
        </p>
        <button onClick={home.retry}>Atualizar</button>
        <Link href="/comecar">Escolher residência</Link>
      </main>
    );
  return (
    <AccountsView
      key={home.householdId}
      household={home.householdId}
      period={home.period}
      homes={home.households}
      selectHome={home.selectHousehold}
    />
  );
}
function AccountsView({
  household,
  period,
  homes,
  selectHome,
}: {
  household: string;
  period: string;
  homes: { id: string; name: string }[];
  selectHome: (id: string) => void;
}) {
  const state = useAccounts(household);
  const [archived, setArchived] = useState(false),
    [search, setSearch] = useState(""),
    [hidden, setHidden] = useState(false),
    [editing, setEditing] = useState<ManagedAccount | null>(null),
    [archiving, setArchiving] = useState<ManagedAccount | null>(null),
    [name, setName] = useState(""),
    [kind, setKind] = useState("checking");
  const groups = groupAccounts(state.accounts, { archived, search });
  const href = (path: string, extra: Record<string, string> = {}) =>
    `${path}?${new URLSearchParams({ household, period, ...extra })}`;
  return (
    <main className="dashboard accounts-page">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href={href("/inicio")}>
          🌿 Ninho
        </Link>
        <nav>
          <Link href={href("/inicio")}>Início</Link>
          <Link href={href("/lancamentos")}>Lançamentos</Link>
          <strong aria-current="page">Contas</strong>
          <Link href={href("/residencia")}>Minha residência</Link>
          <Link href={href("/categorias")}>Categorias</Link>
          <Link href={href("/gerenciar-fontes")}>Fontes de renda</Link>
        </nav>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <label>
            Residência{" "}
            <select
              aria-label="Residência atual"
              value={household}
              disabled={state.busy}
              onChange={(e) => selectHome(e.target.value)}
            >
              {homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <section className="accounts-hero">
          <div>
            <Link href={href("/inicio")}>‹ Início</Link>
            <h1>Minhas contas</h1>
            <p>Cada conta, um cantinho do seu dinheiro.</p>
            <Link className="primary" href={href("/configuracao-inicial")}>
              ＋ Nova conta
            </Link>
          </div>
          <Image
            src={
              archived
                ? "/images/pipo-archive.png"
                : "/images/pipo-accounts.png"
            }
            width={420}
            height={280}
            alt="Pipo organizando carteiras e um caderno de contas"
          />
        </section>
        <div className="accounts-toolbar">
          <div role="group" aria-label="Situação das contas">
            <button aria-pressed={!archived} onClick={() => setArchived(false)}>
              Ativas ({state.accounts.filter((a) => !a.archivedAt).length})
            </button>
            <button aria-pressed={archived} onClick={() => setArchived(true)}>
              Arquivadas ({state.accounts.filter((a) => a.archivedAt).length})
            </button>
          </div>
          <label className="sr-only" htmlFor="account-search">
            Buscar conta
          </label>
          <input
            id="account-search"
            type="search"
            value={search}
            placeholder="Buscar conta pelo nome"
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => setHidden(!hidden)} aria-pressed={hidden}>
            {hidden ? "Mostrar saldos" : "Ocultar saldos"}
          </button>
          <button disabled={state.busy} onClick={state.reload}>
            Atualizar contas
          </button>
        </div>
        {state.notice ? (
          <p role="status" className="accounts-notice">
            {state.notice}
          </p>
        ) : null}
        {archived ? (
          <p className="accounts-notice">
            Contas arquivadas mantêm seu histórico e não ficam disponíveis para
            novos lançamentos.
          </p>
        ) : null}
        {state.loading ? (
          <p role="status">Carregando suas contas…</p>
        ) : state.error ? (
          <section className="accounts-notice" role="alert">
            <h2>Não foi possível carregar as contas</h2>
            <p>{state.error}</p>
            <button onClick={state.reload}>Tentar novamente</button>
          </section>
        ) : groups.length === 0 ? (
          <section className="dashboard-panel accounts-empty">
            <h2>
              {search
                ? "Nenhuma conta encontrada"
                : archived
                  ? "Nenhuma conta arquivada"
                  : "Vamos preparar seu Ninho?"}
            </h2>
            <p>
              {search
                ? "Tente outro nome."
                : archived
                  ? "As contas arquivadas aparecerão aqui."
                  : "Crie sua primeira conta para organizar o dinheiro do seu lar."}
            </p>
            {!archived && !search ? (
              <Link className="primary" href={href("/configuracao-inicial")}>
                Criar primeira conta
              </Link>
            ) : null}
          </section>
        ) : (
          groups.map((group) => (
            <section key={group.currency} className="accounts-group">
              <header>
                <div>
                  <h2>{group.currency}</h2>
                  <p>
                    {group.accounts.length} contas {search ? "encontradas" : ""}
                  </p>
                </div>
                <div>
                  <span>
                    {archived
                      ? "Saldo das arquivadas"
                      : "Saldo das contas exibidas"}
                  </span>
                  <strong>
                    {hidden ? "••••" : money(group.balance, group.currency)}
                  </strong>
                </div>
              </header>
              <div className="accounts-grid">
                {group.accounts.map((a) => (
                  <article key={a.id} className="dashboard-panel account-card">
                    <div className="account-card-heading">
                      <span aria-hidden="true" className="account-symbol">
                        ▣
                      </span>
                      <div>
                        <h3>{a.name}</h3>
                        <p>
                          {accountKindLabel(a.kind)} · {a.currency}
                        </p>
                      </div>
                      <span className="account-status">
                        {a.archivedAt ? "Arquivada" : "Ativa"}
                      </span>
                    </div>
                    <p
                      className={
                        a.balance < 0
                          ? "account-amount negative"
                          : "account-amount"
                      }
                    >
                      {hidden ? "••••" : money(a.balance, a.currency)}
                    </p>
                    <Link
                      href={href(
                        a.archivedAt ? "/lancamentos" : "/composicao-saldo",
                        {
                          accountId: a.id,
                          currency: a.currency,
                        },
                      )}
                    >
                      {a.archivedAt
                        ? "Consultar histórico preservado →"
                        : "Ver detalhes da conta →"}
                    </Link>
                    <Link
                      className="account-statement"
                      href={href("/lancamentos", { accountId: a.id })}
                    >
                      Ver extrato →
                    </Link>
                    {!a.archivedAt ? (
                      <>
                        <div className="account-actions">
                          {[
                            ["income", "Entrada"],
                            ["expense", "Saída"],
                            ["transfer", "Transferência"],
                          ].map(([k, label]) => (
                            <Link
                              key={k}
                              href={href("/novo-registro", {
                                kind: k,
                                accountId: a.id,
                                currency: a.currency,
                              })}
                            >
                              {label}
                            </Link>
                          ))}
                        </div>
                        <div className="account-actions">
                          <button
                            disabled={state.busy}
                            onClick={() => {
                              setEditing(a);
                              setName(a.name);
                              setKind(a.kind.toLowerCase());
                            }}
                          >
                            Editar conta
                          </button>
                          <button
                            disabled={state.busy}
                            onClick={() => setArchiving(a)}
                          >
                            Arquivar
                          </button>
                        </div>
                      </>
                    ) : (
                      <p>
                        Arquivada em{" "}
                        {new Date(a.archivedAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
        <p className="dashboard-caption">
          Saldos atuais calculados pelos lançamentos. Moedas diferentes são
          apresentadas separadamente.
        </p>
        <Link href={href("/composicao-saldo")}>
          Consultar composição do saldo por período →
        </Link>
        {editing ? (
          <AccountDialog
            aria-labelledby="edit-account-title"
            onCancel={(e) => {
              e.preventDefault();
              if (!state.busy) setEditing(null);
            }}
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await state.edit(editing.id, name, kind)) setEditing(null);
              }}
            >
              <Image
                className="accounts-dialog-art"
                src="/images/pipo-accounts.png"
                width={240}
                height={160}
                alt="Pipo organizando suas contas"
              />
              <h2 id="edit-account-title">Editar conta</h2>
              <label>
                Nome
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Tipo
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {kinds.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p>A moeda e os lançamentos permanecem vinculados à conta.</p>
              <div className="account-actions">
                <button
                  type="button"
                  disabled={state.busy}
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </button>
                <button
                  className="primary"
                  disabled={state.busy || !name.trim()}
                >
                  {state.busy ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
              {state.notice ? <p role="status">{state.notice}</p> : null}
            </form>
          </AccountDialog>
        ) : null}
        {archiving ? (
          <AccountDialog
            aria-labelledby="archive-account-title"
            onCancel={(e) => {
              e.preventDefault();
              if (!state.busy) setArchiving(null);
            }}
          >
            <Image
              className="accounts-dialog-art"
              src="/images/pipo-archive.png"
              width={240}
              height={160}
              alt="Pipo guardando o caderno de contas com cuidado"
            />
            <h2 id="archive-account-title">Arquivar {archiving.name}?</h2>
            <p>
              A conta sairá da lista de ativas. Seu saldo e histórico serão
              preservados, e ela não poderá receber novos lançamentos.
            </p>
            <div className="account-actions">
              <button disabled={state.busy} onClick={() => setArchiving(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                disabled={state.busy}
                onClick={async () => {
                  if (await state.archive(archiving.id)) setArchiving(null);
                }}
              >
                {state.busy ? "Arquivando…" : "Confirmar arquivamento"}
              </button>
            </div>
            {state.notice ? <p role="status">{state.notice}</p> : null}
          </AccountDialog>
        ) : null}
      </div>
    </main>
  );
}

function AccountDialog({
  children,
  ...props
}: {
  children: ReactNode;
  "aria-labelledby": string;
  onCancel?: (event: React.SyntheticEvent<HTMLDialogElement>) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog ref={dialog} {...props} className="accounts-dialog">
      {children}
    </dialog>
  );
}
