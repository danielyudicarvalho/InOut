"use client";
import { AuxiliarySelector, DateSelector } from "./auxiliary-selector";
import { BrandLogo } from "./brand-logo";
import { type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { type RecordKind } from "@inout/finance";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import { useRecord } from "../lib/finance/use-record";
const titles = {
  income: "Nova entrada",
  expense: "Nova saída",
  transfer: "Nova transferência",
};
export function NewRecordScreen() {
  const p = useSearchParams(),
    kind = p.get("kind") ?? "",
    household = p.get("household") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "";
  if (!["income", "expense", "transfer"].includes(kind))
    return (
      <main className="financial-state">
        <h1>Tipo de movimentação inválido</h1>
        <Link href="/inicio">Voltar ao início</Link>
      </main>
    );
  return (
    <RecordView
      key={`${kind}:${household}:${period}:${currency}`}
      kind={kind as RecordKind}
      household={household}
      period={period}
      currency={currency}
    />
  );
}
function RecordView({
  kind,
  household,
  period,
  currency,
}: {
  kind: RecordKind;
  household: string;
  period: string;
  currency: string;
}) {
  const home = useFinancialHome({
    initialHouseholdId: household,
    initialPeriod: period,
  });
  if (home.status !== "ready" || !home.data)
    return (
      <main className="financial-state">
        <h1>{titles[kind]}</h1>
        <p role="status">
          {home.status === "loading"
            ? "Carregando residência…"
            : home.notice || "Nenhuma residência disponível."}
        </p>
        {home.status !== "loading" ? (
          <button onClick={home.retry}>Tentar novamente</button>
        ) : null}
        <Link href="/inicio">Voltar ao início</Link>
      </main>
    );
  return (
    <RecordForm
      household={home.householdId}
      kind={kind}
      period={home.period}
      currency={currency}
      householdName={
        home.households.find((row) => row.id === home.householdId)?.name ??
        "Residência"
      }
    />
  );
}
function RecordForm({
  household,
  kind,
  period,
  currency,
  householdName,
}: {
  household: string;
  kind: RecordKind;
  period: string;
  currency: string;
  householdName: string;
}) {
  const state = useRecord(household, kind, currency);
  const back = `/lancamentos?${new URLSearchParams({ household, period, currency })}`;
  if (state.status === "loading" || state.status === "error" || !state.options)
    return (
      <main className="financial-state">
        <h1>{titles[kind]}</h1>
        <p role="status">
          {state.status === "loading"
            ? "Carregando contas e categorias…"
            : state.notice}
        </p>
        {state.status === "error" ? (
          <button onClick={state.retry}>Tentar novamente</button>
        ) : null}
        <Link href={back}>Voltar ao início</Link>
      </main>
    );
  const options = state.options,
    fields = state.fields,
    locked = state.status !== "ready",
    account = options.accounts.find((row) => row.id === fields.accountId);
  const categories = options.categories.filter(
      (row) => row.flow === state.kind,
    ),
    destinations = options.accounts.filter(
      (row) =>
        row.id !== fields.accountId && row.currency === account?.currency,
    );
  const unavailable =
    !options.accounts.length ||
    (state.kind === "transfer"
      ? destinations.length === 0
      : categories.length === 0);
  const selectedCategory = categories.find((c) => c.id === fields.categoryId),
    parentId = selectedCategory?.parentId ?? fields.categoryId;
  const roots = categories.filter((c) => !c.parentId),
    children = categories.filter((c) => c.parentId === parentId);
  const creation = (
    target: "account" | "category" | "source",
    field: "accountId" | "destinationId" | "categoryId" | "sourceId",
    parent = "",
  ) => ({
    household,
    kind: target,
    flow: state.kind,
    parentId: parent,
    currency: account?.currency || currency || "BRL",
    fixedCurrency: field === "destinationId",
    onCreated: (id: string) => {
      state.edit(field, id);
      state.retry();
    },
  });
  const successHref = `/inicio?${new URLSearchParams({ household, period: fields.date.slice(0, 7), currency: account?.currency ?? currency })}`;
  function submit(event: FormEvent) {
    event.preventDefault();
    void state.submit();
  }
  return (
    <main
      className={`record-page record-income-layout ${state.kind === "expense" ? "record-expense-layout" : state.kind === "transfer" ? "record-transfer-layout" : ""}`}
    >
      {
        <aside className="dashboard-sidebar">
          <Link
            className="dashboard-brand"
            href={`/inicio?${new URLSearchParams({ household, period, currency })}`}
          >
            <BrandLogo />
          </Link>
          <p className="record-household">⌂ {householdName}</p>
          <nav aria-label="Navegação principal">
            <Link
              href={`/inicio?${new URLSearchParams({ household, period, currency })}`}
            >
              Início
            </Link>
            <Link href={back} aria-current="page">
              Lançamentos
            </Link>
            <Link
              href={`/composicao-saldo?${new URLSearchParams({ household, period, currency })}`}
            >
              Contas
            </Link>
          </nav>
          <p className="dashboard-motto">
            Grandes conquistas também nascem de pequenos registros. ♡
          </p>
        </aside>
      }
      <div className="record-main">
        <section className="dashboard-panel record-form-panel">
          <header>
            <Link className="balance-back" href={back}>
              ‹ Lançamentos
            </Link>
            <Image
              src={
                state.kind === "income"
                  ? "/images/pipo-income-form.webp"
                  : state.kind === "expense"
                    ? "/images/pipo-expense-form.webp"
                    : "/images/pipo-transfer-form.webp"
              }
              width={600}
              height={300}
              sizes="260px"
              alt={
                state.kind === "income"
                  ? "Pipo guardando uma moeda em uma bolsinha"
                  : state.kind === "expense"
                    ? "Pipo conferindo as compras e o recibo"
                    : "Pipo levando uma moeda pela ponte entre duas contas"
              }
            />
            <p>{householdName}</p>
            <h1>{titles[state.kind]}</h1>
            <p>
              {state.kind === "transfer"
                ? "Mova dinheiro entre as contas do seu lar."
                : state.kind === "income"
                  ? "Registre um dinheiro que entrou no seu lar."
                  : "Registre um gasto do seu lar."}
            </p>
          </header>
          {state.status === "success" ? (
            <div>
              <p role="status">Registro salvo com sucesso.</p>
              <Link className="primary record-success" href={successHref}>
                Ver o período do lançamento
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              {state.notice ? (
                <p role="alert" className="record-notice">
                  {state.notice}
                </p>
              ) : null}
              {unavailable && !locked ? (
                <p role="alert">
                  {!options.accounts.length
                    ? "Crie uma conta financeira antes de registrar."
                    : state.kind === "transfer"
                      ? "Uma transferência precisa de duas contas diferentes na mesma moeda."
                      : "Cadastre uma categoria correspondente a este tipo de movimentação antes de registrar."}
                </p>
              ) : null}
              <fieldset disabled={locked}>
                <label className="record-account">
                  {state.kind === "transfer"
                    ? "Conta de origem *"
                    : state.kind === "income"
                      ? "Conta de destino *"
                      : "Conta de origem *"}
                  <AuxiliarySelector
                    title={
                      state.kind === "income"
                        ? "Selecionar conta de destino"
                        : "Selecionar conta de origem"
                    }
                    value={fields.accountId}
                    items={options.accounts.map((a) => ({
                      ...a,
                      detail: a.currency,
                    }))}
                    disabled={locked}
                    onChange={(id) => state.edit("accountId", id)}
                    create={creation("account", "accountId")}
                  />
                </label>
                {state.kind === "transfer" && (
                  <label className="record-destination">
                    Conta de destino *
                    <AuxiliarySelector
                      title="Selecionar conta de destino"
                      value={fields.destinationId}
                      items={options.accounts.map((a) => ({
                        ...a,
                        detail: `${a.currency}${a.id === account?.id ? " · Mesma conta de origem" : a.currency !== account?.currency ? " · Moeda incompatível" : ""}`,
                        disabled:
                          a.id === account?.id ||
                          a.currency !== account?.currency,
                      }))}
                      disabled={!account || locked}
                      onChange={(id) => state.edit("destinationId", id)}
                      create={creation("account", "destinationId")}
                    />
                  </label>
                )}
                {state.kind === "transfer" && account && (
                  <div className="record-unavailable">
                    <strong>Contas indisponíveis</strong>
                    {options.accounts
                      .filter(
                        (a) =>
                          a.id === account.id ||
                          a.currency !== account.currency,
                      )
                      .map((a) => (
                        <p key={a.id}>
                          {a.name} · {a.currency}
                          <small>
                            {a.id === account.id
                              ? "Mesma conta de origem"
                              : "Moeda incompatível"}
                          </small>
                        </p>
                      ))}
                  </div>
                )}
                {
                  <label className="record-currency">
                    Moeda da conta
                    <input
                      readOnly
                      value={account?.currency ?? "Selecione uma conta"}
                      aria-label="Moeda da conta, definida pela conta escolhida"
                    />
                    <small>A moeda é definida pela conta escolhida. 🔒</small>
                  </label>
                }
                <label className="record-amount">
                  Valor * {account ? `(${account.currency})` : ""}
                  <input
                    required
                    inputMode="decimal"
                    placeholder="1250,50"
                    value={fields.amount}
                    onChange={(e) => state.edit("amount", e.target.value)}
                  />
                  <small>
                    Use vírgula ou ponto para os centavos, sem separador de
                    milhar.
                  </small>
                </label>
                {state.kind !== "transfer" && (
                  <label className="record-category">
                    Categoria *
                    <AuxiliarySelector
                      title="Selecionar categoria"
                      value={
                        state.kind === "expense" ? parentId : fields.categoryId
                      }
                      items={state.kind === "expense" ? roots : categories}
                      disabled={locked}
                      onChange={(id) => state.edit("categoryId", id)}
                      create={creation("category", "categoryId")}
                    />
                  </label>
                )}
                {state.kind === "expense" && (
                  <label className="record-subcategory">
                    Subcategoria (opcional)
                    <AuxiliarySelector
                      title="Selecionar subcategoria"
                      value={
                        selectedCategory?.parentId ? fields.categoryId : ""
                      }
                      items={[
                        { id: "", name: "Usar a categoria selecionada" },
                        ...children,
                      ]}
                      context={`Categoria: ${categories.find((c) => c.id === parentId)?.name ?? ""}`}
                      disabled={!parentId || locked}
                      onChange={(id) =>
                        state.edit("categoryId", id || parentId)
                      }
                      create={creation("category", "categoryId", parentId)}
                    />
                  </label>
                )}
                {state.kind === "income" ? (
                  <label className="record-source">
                    Fonte de renda (opcional)
                    <AuxiliarySelector
                      title="Selecionar fonte de renda"
                      value={fields.sourceId}
                      items={[
                        { id: "", name: "Sem fonte" },
                        ...options.sources,
                      ]}
                      disabled={locked}
                      onChange={(id) => state.edit("sourceId", id)}
                      create={creation("source", "sourceId")}
                    />
                  </label>
                ) : null}
                <label className="record-date">
                  Data *
                  <DateSelector
                    value={fields.date}
                    disabled={locked}
                    onChange={(value) => state.edit("date", value)}
                  />
                </label>
                <label className="record-description">
                  Descrição (opcional)
                  <textarea
                    maxLength={500}
                    value={fields.description}
                    onChange={(e) => state.edit("description", e.target.value)}
                  />
                  <small className="record-count">
                    {fields.description.length}/500
                  </small>
                </label>
              </fieldset>
              {state.kind === "transfer" && (
                <div className="record-transfer-notice">
                  <strong>
                    ⓘ Transferências não contam como receita ou despesa.
                  </strong>
                  <p>Escolha contas diferentes e com a mesma moeda.</p>
                </div>
              )}
              <div className="record-actions">
                <small>* Campos obrigatórios</small>
                <Link
                  className="record-cancel"
                  href={back}
                  aria-disabled={state.status === "saving"}
                  onClick={(e) => {
                    if (state.status === "saving") e.preventDefault();
                  }}
                >
                  {state.status === "uncertain"
                    ? "Voltar aos lançamentos"
                    : "Cancelar"}
                </Link>
                <button
                  className="primary record-submit"
                  type="submit"
                  disabled={
                    state.status === "saving" ||
                    (state.status === "ready" && unavailable)
                  }
                >
                  {state.status === "saving"
                    ? "Salvando…"
                    : state.status === "uncertain"
                      ? "Verificar tentativa pendente"
                      : state.kind === "income"
                        ? "Registrar entrada"
                        : state.kind === "expense"
                          ? "Registrar saída"
                          : "Registrar transferência"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
