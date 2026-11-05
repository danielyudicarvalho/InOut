"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  categoryParentChoices,
  canArchiveCategory,
  type CatalogItem,
  type CatalogCategory,
  type CatalogType,
} from "@inout/finance/catalog";
import { money, displayDate, periodLabel } from "@inout/finance";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import { useCatalog } from "../lib/finance/use-catalog";
import { useLedgerHistory } from "../lib/finance/use-ledger-history";
import { useSourceShare } from "../lib/finance/use-source-share";
import { PeriodPicker } from "./period-picker";
import "./accounts.css";
import "./catalog.css";
export function CatalogScreen({ type }: { type: CatalogType }) {
  const p = useSearchParams();
  const home = useFinancialHome({
    initialHouseholdId: p.get("household") ?? "",
    initialPeriod: p.get("period") ?? "",
  });
  if (home.status !== "ready")
    return (
      <main className="financial-state">
        <h1>{type === "categories" ? "Categorias" : "Fontes de renda"}</h1>
        <p role="status">
          {home.status === "loading"
            ? "Preparando seu Ninho…"
            : home.notice || "Escolha uma residência."}
        </p>
        <button onClick={home.retry}>Atualizar</button>
        <Link href="/comecar">Escolher residência</Link>
      </main>
    );
  return (
    <CatalogView
      key={`${home.householdId}:${type}`}
      type={type}
      household={home.householdId}
      period={home.period}
      setPeriod={home.selectPeriod}
      homes={home.households}
      selectHome={home.selectHousehold}
    />
  );
}
function CatalogView({
  type,
  household,
  period,
  setPeriod,
  homes,
  selectHome,
}: {
  type: CatalogType;
  household: string;
  period: string;
  setPeriod: (v: string) => void;
  homes: { id: string; name: string }[];
  selectHome: (v: string) => void;
}) {
  const state = useCatalog(household);
  const [archived, setArchived] = useState(false),
    [flow, setFlow] = useState<"income" | "expense">("expense"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [archiving, setArchiving] = useState<CatalogItem | null>(null),
    [name, setName] = useState(""),
    [parent, setParent] = useState(""),
    [picker, setPicker] = useState(false);
  const categories = type === "categories",
    title = categories ? "Categorias" : "Fontes de renda";
  const all = categories ? state.categories : state.sources;
  const shown = all.filter(
    (item) =>
      Boolean(item.archivedAt) === archived &&
      (!categories || (item as CatalogCategory).flow === flow) &&
      item.name
        .toLocaleLowerCase("pt-BR")
        .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  shown.sort((a, b) => {
    const path = (row: CatalogItem) => {
      const parentId = (row as CatalogCategory).parentId;
      const root = state.categories.find((c) => c.id === parentId);
      return `${root?.name ?? row.name}\u0000${parentId ? row.name : ""}`;
    };
    return path(a).localeCompare(path(b), "pt-BR");
  });
  const item = all.find((row) => row.id === selected);
  const children = state.categories.filter((row) => row.parentId === item?.id);
  const parents = categoryParentChoices(state.categories, flow);
  const href = (path: string, extra: Record<string, string> = {}) =>
    `${path}?${new URLSearchParams({ household, period, ...extra })}`;
  const newForm = (parentId = "") => {
    setName("");
    setParent(parentId);
    setCreating(true);
  };
  return (
    <main className="dashboard accounts-page catalog-page">
      <aside className="dashboard-sidebar">
        <Link className="dashboard-brand" href={href("/inicio")}>
          🌿 Ninho
        </Link>
        <nav>
          <Link href={href("/inicio")}>Início</Link>
          <Link href={href("/contas")}>Contas</Link>
          <Link
            href={href("/categorias")}
            aria-current={categories ? "page" : undefined}
          >
            Categorias
          </Link>
          <Link
            href={href("/gerenciar-fontes")}
            aria-current={!categories ? "page" : undefined}
          >
            Fontes de renda
          </Link>
        </nav>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <label>
            Residência{" "}
            <select
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
            <p className="catalog-eyebrow">
              Organize seu lar, uma folhinha por vez
            </p>
            <h1>{title}</h1>
            <p>
              {categories
                ? "Dê um lugar para cada entrada e saída."
                : "Reconheça de onde vêm as receitas do seu lar."}
            </p>
            <button
              className="primary"
              disabled={
                state.busy ||
                state.loading ||
                Boolean(state.pending) ||
                Boolean(state.error)
              }
              onClick={() => newForm()}
            >
              ＋ {categories ? "Nova categoria" : "Nova fonte"}
            </button>
          </div>
          <Image
            src={
              categories
                ? "/images/pipo-catalog.png"
                : "/images/pipo-source-garden.png"
            }
            width={360}
            height={260}
            alt={
              categories
                ? "Pipo organizando as categorias do lar"
                : "Pipo cuidando das fontes de renda"
            }
          />
        </section>
        <div className="accounts-toolbar">
          {categories ? (
            <div role="group" aria-label="Fluxo financeiro">
              {(["expense", "income"] as const).map((f) => (
                <button
                  key={f}
                  aria-pressed={flow === f}
                  onClick={() => {
                    setFlow(f);
                    setSelected("");
                  }}
                >
                  {f === "income" ? "Entradas" : "Saídas"}
                </button>
              ))}
            </div>
          ) : null}
          <div role="group" aria-label="Situação">
            <button aria-pressed={!archived} onClick={() => setArchived(false)}>
              Ativas
            </button>
            <button aria-pressed={archived} onClick={() => setArchived(true)}>
              Arquivadas
            </button>
          </div>
          <input
            aria-label="Buscar pelo nome"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pelo nome"
          />
          <button disabled={state.busy} onClick={state.retry}>
            Atualizar
          </button>
        </div>
        {state.notice ? (
          <p className="accounts-notice" role="status">
            {state.notice}
          </p>
        ) : null}
        {state.pending ? (
          <section className="accounts-notice">
            <h2>Cadastro aguardando confirmação</h2>
            <p>
              Vamos verificar “{state.pending.body.name}” usando a mesma
              identificação, sem criar uma cópia.
            </p>
            <button
              disabled={state.busy || state.loading || Boolean(state.error)}
              onClick={state.recover}
            >
              Verificar e recuperar cadastro
            </button>
          </section>
        ) : null}
        {state.loading ? (
          <p role="status">Carregando…</p>
        ) : state.error ? (
          <section role="alert">
            <p>{state.error}</p>
            <button onClick={state.retry}>Tentar novamente</button>
          </section>
        ) : (
          <div className="catalog-layout">
            <section className="catalog-list" aria-label={title}>
              {shown.length ? (
                shown.map((row) => {
                  const category = row as CatalogCategory;
                  const root = category.parentId
                    ? state.categories.find((c) => c.id === category.parentId)
                    : null;
                  return (
                    <article
                      className={`account-card ${category.parentId ? "catalog-child" : ""}`}
                      key={row.id}
                    >
                      <button
                        className="catalog-row"
                        aria-expanded={selected === row.id}
                        onClick={() => setSelected(row.id)}
                      >
                        <span className="catalog-badge" aria-hidden="true">
                          {categories ? "❀" : "♧"}
                        </span>
                        <span>
                          <strong>{row.name}</strong>
                          <small>
                            {root
                              ? `${root.name} › Subcategoria`
                              : categories
                                ? "Categoria principal"
                                : "Fonte de renda"}{" "}
                            · {row.archivedAt ? "Arquivada" : "Ativa"}
                          </small>
                        </span>
                        <span aria-hidden="true">›</span>
                      </button>
                    </article>
                  );
                })
              ) : (
                <section className="account-card">
                  <h2>
                    {search
                      ? "Nenhum resultado"
                      : archived
                        ? "Seu arquivo está vazio"
                        : "Vamos organizar seu Ninho?"}
                  </h2>
                  <p>
                    {search
                      ? "Tente outro nome."
                      : archived
                        ? "O histórico será preservado ao arquivar."
                        : "Use o botão acima para criar o primeiro cadastro."}
                  </p>
                </section>
              )}
            </section>
            {item ? (
              <section
                className="account-card catalog-detail"
                aria-label={`Detalhe de ${item.name}`}
              >
                <p className="catalog-eyebrow">
                  {categories ? "Detalhe da categoria" : "Detalhe da fonte"}
                </p>
                <h2>{item.name}</h2>
                <p>
                  {item.archivedAt
                    ? `Arquivada em ${displayDate(item.archivedAt.slice(0, 10))}. Seu histórico permanece disponível.`
                    : "Ativa para novos lançamentos."}
                </p>
                {categories ? (
                  <>
                    <h3>Subcategorias</h3>
                    {(item as CatalogCategory).parentId ? (
                      <p>
                        Esta é uma subcategoria. O Ninho permite apenas um
                        nível.
                      </p>
                    ) : (
                      <>
                        <ul>
                          {children.map((child) => (
                            <li key={child.id}>
                              <button onClick={() => setSelected(child.id)}>
                                {child.name} ·{" "}
                                {child.archivedAt ? "Arquivada" : "Ativa"}
                              </button>
                            </li>
                          ))}
                        </ul>
                        {!children.length ? (
                          <p>Ainda sem subcategorias.</p>
                        ) : null}
                        {!item.archivedAt ? (
                          <button
                            disabled={state.busy || Boolean(state.pending)}
                            onClick={() => newForm(item.id)}
                          >
                            ＋ Nova subcategoria
                          </button>
                        ) : null}
                      </>
                    )}
                  </>
                ) : null}
                <button onClick={() => setPicker(true)}>
                  {periodLabel(period)} · Alterar período
                </button>
                {!categories
                  ? state.currencies.map((currency) => (
                      <SourceShare
                        key={`${item.id}:${period}:${currency}`}
                        household={household}
                        period={period}
                        currency={currency}
                        sourceId={item.id}
                      />
                    ))
                  : null}
                <CatalogHistory
                  key={`${item.id}:${period}`}
                  household={household}
                  period={period}
                  id={item.id}
                  type={type}
                />
                <Link
                  href={href("/lancamentos", {
                    [categories ? "categoryId" : "incomeSourceId"]: item.id,
                  })}
                >
                  Ver todas as movimentações →
                </Link>
                {!item.archivedAt ? (
                  <div className="account-actions">
                    <button
                      disabled={state.busy || Boolean(state.pending)}
                      onClick={() => setArchiving(item)}
                    >
                      Arquivar {categories ? "categoria" : "fonte"}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : (
              <section className="account-card catalog-detail">
                <h2>Um lugar para cada registro</h2>
                <p>
                  Selecione {categories ? "uma categoria" : "uma fonte"} para
                  consultar detalhes e movimentações.
                </p>
              </section>
            )}
          </div>
        )}
        <p className="dashboard-caption">
          Arquivar mantém a identificação dos lançamentos antigos. Subcategorias
          têm o mesmo fluxo da categoria principal.
        </p>
        {picker ? (
          <PeriodPicker
            value={period}
            onClose={() => setPicker(false)}
            onApply={(value) => {
              setPeriod(value);
              setPicker(false);
            }}
          />
        ) : null}
        {creating ? (
          <CatalogDialog
            title="catalog-create-title"
            busy={state.busy}
            onClose={() => setCreating(false)}
          >
            <Image
              className="accounts-dialog-art"
              src={
                categories
                  ? "/images/pipo-catalog.png"
                  : "/images/pipo-source-garden.png"
              }
              width={200}
              height={150}
              alt="Pipo preparando um novo cantinho"
            />
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await state.create(type, {
                    name,
                    flow,
                    parentId: parent || null,
                  })
                )
                  setCreating(false);
              }}
            >
              <h2 id="catalog-create-title">
                {categories
                  ? parent
                    ? "Nova subcategoria"
                    : "Nova categoria"
                  : "Nova fonte de renda"}
              </h2>
              <label>
                Nome
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={name}
                  disabled={state.busy || Boolean(state.pending)}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {categories ? (
                <>
                  <label>
                    Fluxo financeiro
                    <select
                      value={flow}
                      disabled={state.busy || Boolean(state.pending)}
                      onChange={(e) => {
                        setFlow(e.target.value as "income" | "expense");
                        setParent("");
                      }}
                    >
                      <option value="expense">Saída</option>
                      <option value="income">Entrada</option>
                    </select>
                  </label>
                  <label>
                    Categoria principal
                    <select
                      value={parent}
                      disabled={state.busy || Boolean(state.pending)}
                      onChange={(e) => setParent(e.target.value)}
                    >
                      <option value="">Sem categoria principal</option>
                      {parents.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Apenas categorias principais ativas do mesmo fluxo podem
                    receber subcategorias. Há somente um nível.
                  </p>
                </>
              ) : (
                <p>
                  Uma fonte identifica a origem da receita, como salário ou
                  trabalho autônomo.
                </p>
              )}
              <div className="account-actions">
                <button
                  type="button"
                  disabled={state.busy}
                  onClick={() => setCreating(false)}
                >
                  Fechar
                </button>
                <button
                  className="primary"
                  disabled={
                    state.busy || Boolean(state.pending) || !name.trim()
                  }
                >
                  {state.busy ? "Salvando…" : "Salvar"}
                </button>
              </div>
              {state.notice ? <p role="status">{state.notice}</p> : null}
              {state.pending ? (
                <p>
                  Feche este painel e use a recuperação do cadastro pendente.
                </p>
              ) : null}
            </form>
          </CatalogDialog>
        ) : null}
        {archiving ? (
          <CatalogDialog
            title="catalog-archive-title"
            busy={state.busy}
            onClose={() => setArchiving(null)}
          >
            <Image
              className="accounts-dialog-art"
              src="/images/pipo-archive.png"
              width={200}
              height={150}
              alt="Pipo preservando seu histórico"
            />
            <h2 id="catalog-archive-title">Arquivar {archiving.name}?</h2>
            <p>
              O cadastro ficará indisponível para novos lançamentos. As receitas
              e despesas antigas manterão sua identificação e continuarão no
              histórico.
            </p>
            {categories &&
            !canArchiveCategory(state.categories, archiving.id) ? (
              <p role="alert">
                Esta categoria tem subcategorias ativas. Arquive cada uma antes
                de continuar.
              </p>
            ) : null}
            <div className="account-actions">
              <button disabled={state.busy} onClick={() => setArchiving(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                disabled={
                  state.busy ||
                  (categories &&
                    !canArchiveCategory(state.categories, archiving.id))
                }
                onClick={async () => {
                  if (await state.archive(type, archiving.id))
                    setArchiving(null);
                }}
              >
                {state.busy ? "Arquivando…" : "Confirmar arquivamento"}
              </button>
            </div>
            {state.notice ? <p role="status">{state.notice}</p> : null}
          </CatalogDialog>
        ) : null}
      </div>
    </main>
  );
}
function CatalogDialog({
  children,
  title,
  busy,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  busy: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="accounts-dialog"
      aria-labelledby={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
function CatalogHistory({
  household,
  period,
  id,
  type,
}: {
  household: string;
  period: string;
  id: string;
  type: CatalogType;
}) {
  const history = useLedgerHistory(
    household,
    period,
    { [type === "categories" ? "categoryId" : "incomeSourceId"]: id },
    0,
  );
  return (
    <section>
      <h3>Movimentações do período</h3>
      {type === "categories" ? (
        <p>
          Registros classificados diretamente nesta categoria. Consulte cada
          subcategoria para seus registros.
        </p>
      ) : null}
      {history.loading ? (
        <p role="status">Carregando registros…</p>
      ) : history.error ? (
        <div role="alert">
          <p>{history.error}</p>
          <button onClick={history.retry}>Tentar novamente</button>
        </div>
      ) : history.items.length ? (
        <ul className="catalog-history">
          {history.items.slice(0, 5).map((row, i) => (
            <li key={`${row.transactionId}:${i}`}>
              <Link
                href={`/lancamento?${new URLSearchParams({ household, period, transaction: row.transactionId })}`}
              >
                <strong>{row.description}</strong>
                <small>
                  {displayDate(row.date)} · {row.accountName} ·{" "}
                  {row.status === "reversed" ? "Estornado" : "Registrado"}
                </small>
                <span>{money(row.amount, row.currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>Sem movimentações neste período.</p>
      )}
    </section>
  );
}
function SourceShare({
  household,
  period,
  currency,
  sourceId,
}: {
  household: string;
  period: string;
  currency: string;
  sourceId: string;
}) {
  const state = useSourceShare(household, period, currency);
  if (state.status !== "ready" || !state.data)
    return (
      <p role="status">
        {state.status === "loading"
          ? "Carregando participação…"
          : "Participação indisponível."}
        {state.status !== "loading" ? (
          <button onClick={state.retry}>Atualizar</button>
        ) : null}
      </p>
    );
  const data = state.data,
    source = data.sources?.find((row) => row.id === sourceId);
  const amount = source?.amount ?? 0;
  const percentage =
    data.total > 0 && data.sources?.every((row) => row.amount >= 0)
      ? Math.round((amount / data.total) * 100)
      : null;
  return (
    <div className="catalog-share">
      <strong>{money(amount, currency)}</strong>
      <p>
        {percentage === null
          ? "Participação percentual não se aplica com receitas líquidas negativas ou total zero."
          : `${percentage}% das receitas em ${currency} no período.`}
      </p>
      <small>
        Valores líquidos, incluindo estornos. Moedas são apresentadas
        separadamente.
      </small>
    </div>
  );
}
