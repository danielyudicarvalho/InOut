"use client";

import type {
  RecordFields,
  RecordKind,
  RecordOptions,
} from "@inout/finance";
import { AuxiliarySelector, DateSelector } from "../selectors/auxiliary-selector";
import { useCategoryHierarchy, type CategoryOption } from "./use-category-hierarchy";

export type AccountOption = RecordOptions["accounts"][number];
export type SourceOption = RecordOptions["sources"][number];

interface RecordFormFieldsProps {
  kind: RecordKind;
  fields: RecordFields;
  accounts: AccountOption[];
  categories: CategoryOption[];
  sources: SourceOption[];
  account: AccountOption | undefined;
  locked: boolean;
  onEdit: (field: keyof RecordFields, value: string) => void;
  createHelper: (
    target: "account" | "category" | "source",
    field: "accountId" | "destinationId" | "categoryId" | "sourceId",
    parent?: string,
  ) => {
    household: string;
    kind: "account" | "category" | "source";
    flow: RecordKind;
    parentId: string;
    currency: string;
    fixedCurrency: boolean;
    onCreated: (id: string) => void;
  };
}

export function RecordFormFields({
  kind,
  fields,
  accounts,
  categories,
  sources,
  account,
  locked,
  onEdit,
  createHelper,
}: RecordFormFieldsProps) {
  const { selectedCategory, parentId, roots, children } =
    useCategoryHierarchy(categories, fields.categoryId);

  return (
    <fieldset disabled={locked}>
      {/* Account Selection */}
      <label className="record-account" data-record-field="accountId">
        {kind === "transfer"
          ? "Conta de origem *"
          : kind === "income"
            ? "Conta de destino *"
            : "Conta de origem *"}
        <AuxiliarySelector
          title={
            kind === "income"
              ? "Selecionar conta de destino"
              : "Selecionar conta de origem"
          }
          value={fields.accountId}
          items={accounts.map((a) => ({
            ...a,
            detail: a.currency,
          }))}
          disabled={locked}
          onChange={(id) => onEdit("accountId", id)}
          create={createHelper("account", "accountId")}
        />
      </label>

      {/* Transfer: Destination Account */}
      {kind === "transfer" && (
        <label className="record-destination" data-record-field="destinationId">
          Conta de destino *
          <AuxiliarySelector
            title="Selecionar conta de destino"
            value={fields.destinationId}
            items={accounts.map((a) => ({
              ...a,
              detail: `${a.currency}${
                a.id === account?.id
                  ? " · Mesma conta de origem"
                  : a.currency !== account?.currency
                    ? " · Moeda incompatível"
                    : ""
              }`,
              disabled:
                a.id === account?.id || a.currency !== account?.currency,
            }))}
            disabled={!account || locked}
            onChange={(id) => onEdit("destinationId", id)}
            create={createHelper("account", "destinationId")}
          />
        </label>
      )}

      {/* Transfer: Unavailable Accounts List */}
      {kind === "transfer" && account && (
        <div className="record-unavailable">
          <strong>Contas indisponíveis</strong>
          {accounts
            .filter(
              (a) => a.id === account.id || a.currency !== account.currency,
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

      {/* Currency Indicator */}
      <label className="record-currency">
        Moeda da conta
        <input
          readOnly
          value={account?.currency ?? "Selecione uma conta"}
          aria-label="Moeda da conta, definida pela conta escolhida"
        />
        <small>A moeda é definida pela conta escolhida. 🔒</small>
      </label>

      {/* Amount Input */}
      <label className="record-amount" data-record-field="amount">
        Valor * {account ? `(${account.currency})` : ""}
        <input
          required
          inputMode="decimal"
          placeholder="1250,50"
          value={fields.amount}
          onChange={(e) => onEdit("amount", e.target.value)}
        />
        <small>
          Use vírgula ou ponto para os centavos, sem separador de milhar.
        </small>
      </label>

      {/* Category Selection */}
      {kind !== "transfer" && (
        <label className="record-category" data-record-field="categoryId">
          Categoria *
          <AuxiliarySelector
            title="Selecionar categoria"
            value={kind === "expense" ? parentId : fields.categoryId}
            items={kind === "expense" ? roots : categories}
            disabled={locked}
            onChange={(id) => onEdit("categoryId", id)}
            create={createHelper("category", "categoryId")}
          />
        </label>
      )}

      {/* Subcategory Selection for Expense */}
      {kind === "expense" && (
        <label className="record-subcategory">
          Subcategoria (opcional)
          <AuxiliarySelector
            title="Selecionar subcategoria"
            value={selectedCategory?.parentId ? fields.categoryId : ""}
            items={[
              { id: "", name: "Usar a categoria selecionada" },
              ...children,
            ]}
            context={`Categoria: ${categories.find((c) => c.id === parentId)?.name ?? ""}`}
            disabled={!parentId || locked}
            onChange={(id) => onEdit("categoryId", id || parentId)}
            create={createHelper("category", "categoryId", parentId)}
          />
        </label>
      )}

      {/* Income Source Selection */}
      {kind === "income" && (
        <label className="record-source" data-record-field="sourceId">
          Fonte de renda (opcional)
          <AuxiliarySelector
            title="Selecionar fonte de renda"
            value={fields.sourceId}
            items={[{ id: "", name: "Sem fonte" }, ...sources]}
            disabled={locked}
            onChange={(id) => onEdit("sourceId", id)}
            create={createHelper("source", "sourceId")}
          />
        </label>
      )}

      {/* Date */}
      <label className="record-date" data-record-field="date">
        Data *
        <DateSelector
          value={fields.date}
          disabled={locked}
          onChange={(value) => onEdit("date", value)}
        />
      </label>

      {/* Description */}
      <label className="record-description" data-record-field="description">
        Descrição (opcional)
        <textarea
          maxLength={500}
          value={fields.description}
          onChange={(e) => onEdit("description", e.target.value)}
        />
        <small className="record-count">
          {fields.description.length}/500
        </small>
      </label>
    </fieldset>
  );
}
