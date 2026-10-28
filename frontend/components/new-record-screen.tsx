"use client";
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
  transfer: "Transferência",
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
  const successHref = `/inicio?${new URLSearchParams({ household, period: fields.date.slice(0, 7), currency: account?.currency ?? currency })}`;
  function submit(event: FormEvent) {
    event.preventDefault();
    void state.submit();
  }
  return (
    <main
      className={`record-page ${state.kind !== "transfer" ? `record-income-layout ${state.kind === "expense" ? "record-expense-layout" : ""}` : ""}`}
    >
      {state.kind !== "transfer" && (
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
      )}
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
                    : "/images/pipo-new-record.webp"
              }
              width={600}
              height={300}
              sizes="260px"
              alt={
                state.kind === "income"
                  ? "Pipo guardando uma moeda em uma bolsinha"
                  : state.kind === "expense"
                    ? "Pipo conferindo as compras e o recibo"
                    : "Pipo escrevendo em um caderno"
              }
            />
            <p>{householdName}</p>
            <h1>{titles[state.kind]}</h1>
            <p>
              {state.kind === "transfer"
                ? "Mova dinheiro entre suas contas. Transferências não contam como receita ou despesa."
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
                  <select
                    required
                    value={fields.accountId}
                    onChange={(e) => state.edit("accountId", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {options.accounts.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} · {row.currency}
                      </option>
                    ))}
                  </select>
                </label>
                {state.kind !== "transfer" && (
                  <label className="record-currency">
                    Moeda da conta
                    <input
                      readOnly
                      value={account?.currency ?? "Selecione uma conta"}
                      aria-label="Moeda da conta, definida pela conta escolhida"
                    />
                    <small>A moeda é definida pela conta escolhida. 🔒</small>
                  </label>
                )}
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
                {state.kind === "transfer" ? (
                  <label>
                    Conta de destino
                    <select
                      required
                      value={fields.destinationId}
                      onChange={(e) =>
                        state.edit("destinationId", e.target.value)
                      }
                    >
                      <option value="">Selecione</option>
                      {destinations.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} · {row.currency}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="record-category">
                    Categoria *
                    <select
                      required
                      value={
                        state.kind === "expense" ? parentId : fields.categoryId
                      }
                      onChange={(e) => state.edit("categoryId", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {(state.kind === "expense" ? roots : categories).map(
                        (row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}
                {state.kind === "expense" && (
                  <label className="record-subcategory">
                    Subcategoria (opcional)
                    <select
                      disabled={!parentId || !children.length || locked}
                      value={
                        selectedCategory?.parentId ? fields.categoryId : ""
                      }
                      onChange={(e) =>
                        state.edit("categoryId", e.target.value || parentId)
                      }
                    >
                      <option value="">
                        {children.length
                          ? "Usar a categoria selecionada"
                          : "Sem subcategorias"}
                      </option>
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {state.kind === "income" ? (
                  <label className="record-source">
                    Fonte de renda (opcional)
                    <select
                      value={fields.sourceId}
                      onChange={(e) => state.edit("sourceId", e.target.value)}
                    >
                      <option value="">Sem fonte de renda</option>
                      {options.sources.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="record-date">
                  Data *
                  <input
                    required
                    type="date"
                    min="2000-01-01"
                    max="9998-12-31"
                    value={fields.date}
                    onChange={(e) => state.edit("date", e.target.value)}
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
                          : "Salvar transferência"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
