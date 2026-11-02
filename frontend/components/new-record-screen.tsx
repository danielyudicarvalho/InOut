"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  ArrowsLeftRight,
  CalendarBlank,
  Tag,
  Wallet,
  Briefcase,
  Sparkle,
  ArrowLeft,
} from "@phosphor-icons/react";
import { displayDate, type RecordKind } from "@inout/finance";
import { useFinancialHome } from "../lib/finance/use-financial-home";
import { useRecord } from "../lib/finance/use-record";
import {
  CategorySelectorModal,
  CategoryIcon,
} from "./selectors/category-selector-modal";
import {
  SubcategorySelectorModal,
  SubcategoryIcon,
} from "./selectors/subcategory-selector-modal";
import {
  AccountSelectorModal,
  AccountIcon,
} from "./selectors/account-selector-modal";
import {
  SourceSelectorModal,
  SourceIcon,
} from "./selectors/source-selector-modal";
import { DateSelectorModal } from "./selectors/date-selector-modal";
import { SelectorTrigger } from "./selectors/selector-trigger";

const titles: Record<RecordKind, string> = {
  income: "Nova entrada",
  expense: "Nova saída",
  transfer: "Transferência",
};

const subtitles: Record<RecordKind, string> = {
  expense: "Registre um gasto para manter tudo em dia.",
  income: "Registre um valor recebido para seu lar.",
  transfer: "Mova dinheiro entre suas contas sem alterar receitas ou despesas.",
};

const submitLabels: Record<RecordKind, string> = {
  expense: "Salvar saída",
  income: "Salvar entrada",
  transfer: "Salvar transferência",
};

export function NewRecordScreen() {
  const p = useSearchParams(),
    kind = p.get("kind") ?? "",
    household = p.get("household") ?? "",
    period = p.get("period") ?? "",
    currency = p.get("currency") ?? "";

  if (!["income", "expense", "transfer"].includes(kind)) {
    return (
      <main className="financial-state">
        <h1>Tipo de movimentação inválido</h1>
        <Link href="/inicio">Voltar ao início</Link>
      </main>
    );
  }

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

  if (home.status !== "ready" || !home.data) {
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
  }

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
  const back = `/inicio?${new URLSearchParams({ household, period, currency })}`;

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [subcategoryModalOpen, setSubcategoryModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [destAccountModalOpen, setDestAccountModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);

  if (
    state.status === "loading" ||
    state.status === "error" ||
    !state.options
  ) {
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
  }

  const options = state.options;
  const fields = state.fields;
  const locked = state.status !== "ready";
  const account = options.accounts.find((row) => row.id === fields.accountId);

  const categories = options.categories.filter(
    (row) => row.flow === state.kind,
  );
  const selectedLeaf =
    categories.find((row) => row.id === fields.categoryId) ?? null;
  const selectedCategory = selectedLeaf?.parentId
    ? (categories.find((row) => row.id === selectedLeaf.parentId) ?? null)
    : selectedLeaf;
  const selectedSubcategory = selectedLeaf?.parentId ? selectedLeaf : null;

  const destinations = options.accounts.filter(
    (row) => row.id !== fields.accountId && row.currency === account?.currency,
  );
  const destinationAccount =
    destinations.find((row) => row.id === fields.destinationId) ?? null;

  const selectedSource =
    options.sources.find((row) => row.id === fields.sourceId) ?? null;

  const unavailable =
    !options.accounts.length ||
    (state.kind === "transfer"
      ? destinations.length === 0
      : categories.length === 0);

  const successHref = `/inicio?${new URLSearchParams({
    household,
    period: fields.date.slice(0, 7),
    currency: account?.currency ?? currency,
  })}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    void state.submit();
  }

  return (
    <main className="ninho-record-screen">
      {/* Top Title Banner matching reference */}
      <header className="ninho-record-page-header">
        <div className="ninho-record-header-text">
          <h1 className="ninho-record-main-title">Seletores auxiliares</h1>
          <p className="ninho-record-main-subtitle">
            Escolhas simples para registrar com tranquilidade.
          </p>
        </div>
        <div className="ninho-record-household-badge">
          <span>{householdName}</span>
        </div>
      </header>

      {/* Main Workspace: Left Illustration + Center Form + Right Illustration */}
      <div className="ninho-record-stage">
        {/* Left Illustration: Pipo with Cards */}
        <aside className="ninho-stage-art ninho-stage-art-left">
          <div className="ninho-art-bubble">
            <p>Pipo sempre ajuda a organizar as suas escolhas. ♡</p>
          </div>
          <Image
            src="/images/pipo-selectors-cards.webp"
            alt="Pipo organizando cartões de categorias e contas"
            width={380}
            height={285}
            className="ninho-pipo-mascot"
            priority
          />
        </aside>

        {/* Center: The Interactive Form */}
        <section className="ninho-form-card">
          <div className="ninho-form-card-top">
            <Link className="ninho-back-link" href={back}>
              <ArrowLeft size={16} /> Voltar ao início
            </Link>

            <div className="ninho-form-header-badge">
              <span className={`ninho-kind-icon-circle ${state.kind}`}>
                {state.kind === "expense" ? (
                  <ArrowDown size={24} weight="bold" />
                ) : state.kind === "income" ? (
                  <ArrowUp size={24} weight="bold" />
                ) : (
                  <ArrowsLeftRight size={24} weight="bold" />
                )}
              </span>
              <div>
                <h2>{titles[state.kind]}</h2>
                <p>{subtitles[state.kind]}</p>
              </div>
            </div>
          </div>

          {state.status === "success" ? (
            <div className="ninho-record-success-panel">
              <span className="ninho-success-check-badge">✓</span>
              <h3>Registro salvo com sucesso!</h3>
              <p>O lançamento foi registrado com segurança.</p>
              <Link className="ninho-primary-btn" href={successHref}>
                Ver no painel do período
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="ninho-record-form">
              {state.notice ? (
                <p role="alert" className="ninho-record-notice">
                  {state.notice}
                </p>
              ) : null}

              {unavailable && !locked ? (
                <p role="alert" className="ninho-record-alert">
                  {!options.accounts.length
                    ? "Crie uma conta financeira antes de registrar."
                    : state.kind === "transfer"
                      ? "Uma transferência precisa de duas contas diferentes na mesma moeda."
                      : "Cadastre uma categoria correspondente a este tipo de movimentação antes de registrar."}
                </p>
              ) : null}

              <fieldset disabled={locked} className="ninho-form-fields">
                {/* Row 1: Valor & Data */}
                <div className="ninho-form-grid-2">
                  <div className="ninho-field-group">
                    <label
                      htmlFor="record-amount-input"
                      className="ninho-field-label"
                    >
                      Valor {account ? `(${account.currency})` : ""}
                    </label>
                    <div className="ninho-input-wrap">
                      <input
                        id="record-amount-input"
                        required
                        inputMode="decimal"
                        placeholder="R$ 0,00"
                        value={fields.amount}
                        onChange={(e) => state.edit("amount", e.target.value)}
                        className="ninho-text-input ninho-amount-input"
                      />
                    </div>
                    <span className="ninho-field-hint">
                      Ex: 1250,50 (vírgula para centavos)
                    </span>
                  </div>

                  <div className="ninho-field-group">
                    <label
                      htmlFor="record-date-input"
                      className="ninho-field-label"
                    >
                      Data
                    </label>
                    <div className="ninho-date-picker-wrap">
                      <input
                        id="record-date-input"
                        required
                        type="text"
                        readOnly
                        value={displayDate(fields.date) || fields.date}
                        onClick={() => setDateModalOpen(true)}
                        className="ninho-text-input ninho-date-trigger-input"
                      />
                      <button
                        type="button"
                        aria-label="Selecionar data no calendário"
                        className="ninho-date-calendar-btn"
                        onClick={() => setDateModalOpen(true)}
                      >
                        <CalendarBlank size={20} weight="bold" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Categoria & Subcategoria (for income & expense) */}
                {state.kind !== "transfer" ? (
                  <div className="ninho-form-grid-2">
                    <SelectorTrigger
                      id="select-category-trigger"
                      label="Categoria"
                      valueText={selectedCategory?.name}
                      placeholder="Selecionar categoria"
                      icon={
                        selectedCategory ? (
                          <CategoryIcon
                            name={selectedCategory.name}
                            size={18}
                          />
                        ) : (
                          <Sparkle size={18} weight="duotone" />
                        )
                      }
                      onClick={() => setCategoryModalOpen(true)}
                    />

                    <SelectorTrigger
                      id="select-subcategory-trigger"
                      label="Subcategoria"
                      valueText={selectedSubcategory?.name}
                      placeholder={
                        selectedCategory
                          ? "Selecionar subcategoria"
                          : "Escolha a categoria antes"
                      }
                      icon={
                        selectedSubcategory ? (
                          <SubcategoryIcon
                            name={selectedSubcategory.name}
                            size={18}
                          />
                        ) : (
                          <Tag size={18} weight="duotone" />
                        )
                      }
                      disabled={!selectedCategory}
                      onClick={() => {
                        if (selectedCategory) {
                          setSubcategoryModalOpen(true);
                        } else {
                          setCategoryModalOpen(true);
                        }
                      }}
                    />
                  </div>
                ) : null}

                {/* Row 3: Conta & Conta de destino / Fonte */}
                <div className="ninho-form-grid-2">
                  <SelectorTrigger
                    id="select-account-trigger"
                    label={
                      state.kind === "transfer" ? "Conta de origem" : "Conta"
                    }
                    valueText={
                      account ? `${account.name} · ${account.currency}` : null
                    }
                    placeholder="Selecionar conta"
                    icon={
                      account ? (
                        <AccountIcon
                          kind={account.kind}
                          name={account.name}
                          size={18}
                        />
                      ) : (
                        <Wallet size={18} weight="duotone" />
                      )
                    }
                    onClick={() => setAccountModalOpen(true)}
                  />

                  {state.kind === "transfer" ? (
                    <SelectorTrigger
                      id="select-dest-account-trigger"
                      label="Conta de destino"
                      valueText={
                        destinationAccount
                          ? `${destinationAccount.name} · ${destinationAccount.currency}`
                          : null
                      }
                      placeholder="Selecionar destino"
                      icon={
                        destinationAccount ? (
                          <AccountIcon
                            kind={destinationAccount.kind}
                            name={destinationAccount.name}
                            size={18}
                          />
                        ) : (
                          <Wallet size={18} weight="duotone" />
                        )
                      }
                      disabled={!account}
                      onClick={() => setDestAccountModalOpen(true)}
                    />
                  ) : state.kind === "income" ? (
                    <SelectorTrigger
                      id="select-source-trigger"
                      label="Fonte de renda (opcional)"
                      valueText={selectedSource?.name ?? "Sem fonte"}
                      placeholder="Selecionar fonte"
                      icon={
                        selectedSource ? (
                          <SourceIcon name={selectedSource.name} size={18} />
                        ) : (
                          <Briefcase size={18} weight="duotone" />
                        )
                      }
                      onClick={() => setSourceModalOpen(true)}
                    />
                  ) : null}
                </div>

                {/* Row 4: Descrição */}
                <div className="ninho-field-group">
                  <label
                    htmlFor="record-description-input"
                    className="ninho-field-label"
                  >
                    Descrição (opcional)
                  </label>
                  <input
                    id="record-description-input"
                    maxLength={500}
                    placeholder="Ex.: Supermercado, farmácia, combustível..."
                    value={fields.description}
                    onChange={(e) => state.edit("description", e.target.value)}
                    className="ninho-text-input"
                  />
                </div>
              </fieldset>

              {/* Form Bottom Actions */}
              <div className="ninho-form-actions">
                <Link className="ninho-secondary-btn" href={back}>
                  Cancelar
                </Link>
                <button
                  className="ninho-primary-btn"
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
                      : submitLabels[state.kind]}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Right Illustration: Pipo holding note with leaf */}
        <aside className="ninho-stage-art ninho-stage-art-right">
          <div className="ninho-art-bubble-right">
            <span className="ninho-tiny-badge">
              Pequenas escolhas, grandes conquistas.
            </span>
            <p>Organizar hoje, um Ninho mais tranquilo amanhã.</p>
          </div>
          <Image
            src="/images/pipo-peaceful-future.webp"
            alt="Pipo segurando um cartão com folha ao lado de caixas de organização"
            width={380}
            height={285}
            className="ninho-pipo-mascot"
            priority
          />
        </aside>
      </div>

      {/* Auxiliary Selector Modals */}
      {categoryModalOpen ? (
        <CategorySelectorModal
          categories={options.categories}
          selectedId={selectedCategory?.id ?? ""}
          flow={state.kind === "income" ? "income" : "expense"}
          onSelect={(id) => {
            state.edit("categoryId", id);
          }}
          onClose={() => setCategoryModalOpen(false)}
          onCreateCategory={async (name, flow) => {
            const result = await state.createCategory(name, flow, null);
            return {
              id: result.id,
              name: result.name,
              flow: result.flow as "income" | "expense",
              parentId: result.parentId,
            };
          }}
        />
      ) : null}

      {subcategoryModalOpen ? (
        <SubcategorySelectorModal
          categories={options.categories}
          parentCategory={selectedCategory}
          selectedId={selectedSubcategory?.id ?? ""}
          onSelect={(id) => {
            state.edit("categoryId", id);
          }}
          onClose={() => setSubcategoryModalOpen(false)}
          onCreateSubcategory={async (name, parentId, flow) => {
            const result = await state.createCategory(name, flow, parentId);
            return {
              id: result.id,
              name: result.name,
              flow: result.flow as "income" | "expense",
              parentId: result.parentId,
            };
          }}
        />
      ) : null}

      {accountModalOpen ? (
        <AccountSelectorModal
          accounts={options.accounts}
          selectedId={fields.accountId}
          householdId={household}
          period={period}
          currency={currency}
          onSelect={(id) => {
            state.edit("accountId", id);
          }}
          onClose={() => setAccountModalOpen(false)}
        />
      ) : null}

      {destAccountModalOpen ? (
        <AccountSelectorModal
          accounts={destinations}
          selectedId={fields.destinationId}
          householdId={household}
          period={period}
          currency={currency}
          onSelect={(id) => {
            state.edit("destinationId", id);
          }}
          onClose={() => setDestAccountModalOpen(false)}
        />
      ) : null}

      {sourceModalOpen ? (
        <SourceSelectorModal
          sources={options.sources}
          selectedId={fields.sourceId}
          onSelect={(id) => {
            state.edit("sourceId", id);
          }}
          onClose={() => setSourceModalOpen(false)}
          onCreateSource={async (name) => {
            const result = await state.createIncomeSource(name);
            return {
              id: result.id,
              name: result.name,
            };
          }}
        />
      ) : null}

      {dateModalOpen ? (
        <DateSelectorModal
          value={fields.date}
          onSelect={(dateString) => {
            state.edit("date", dateString);
          }}
          onClose={() => setDateModalOpen(false)}
        />
      ) : null}
    </main>
  );
}
