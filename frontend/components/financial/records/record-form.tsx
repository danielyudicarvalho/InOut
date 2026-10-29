"use client";

import { type FormEvent, useState, useEffect } from "react";
import Link from "next/link";
import {
  financeMessage,
  recordReview,
  type RecordFields,
  type RecordKind,
  type RecordReview,
} from "@inout/finance";
import {
  RecordFormFields,
  type AccountOption,
  type SourceOption,
} from "./record-form-fields";
import { type CategoryOption } from "./use-category-hierarchy";
import { RecordUnavailableAlert } from "./record-unavailable-alert";

interface RecordFormProps {
  kind: RecordKind;
  household: string;
  currency: string;
  backHref: string;
  status: "ready" | "loading" | "saving" | "uncertain" | "success" | "error";
  notice: string;
  fields: RecordFields;
  accounts: AccountOption[];
  categories: CategoryOption[];
  sources: SourceOption[];
  account: AccountOption | undefined;
  destinations: AccountOption[];
  unavailable: boolean;
  onEdit: (field: keyof RecordFields, value: string) => void;
  onRetry: () => void;
  onReview: (summary: RecordReview) => void;
}

export function RecordForm({
  kind,
  household,
  currency,
  backHref,
  status,
  notice,
  fields,
  accounts,
  categories,
  sources,
  account,
  destinations,
  unavailable,
  onEdit,
  onRetry,
  onReview,
}: RecordFormProps) {
  const [reviewError, setReviewError] = useState("");
  const [focusField, setFocusField] = useState<keyof RecordFields | null>(null);
  const locked = status !== "ready";

  useEffect(() => {
    if (focusField) {
      document
        .querySelector<HTMLElement>(
          `[data-record-field="${focusField}"] button, [data-record-field="${focusField}"] input, [data-record-field="${focusField}"] textarea`,
        )
        ?.focus();
    }
  }, [focusField]);

  const creationHelper = (
    target: "account" | "category" | "source",
    field: "accountId" | "destinationId" | "categoryId" | "sourceId",
    parent = "",
  ) => ({
    household,
    kind: target,
    flow: kind,
    parentId: parent,
    currency: account?.currency || currency || "BRL",
    fixedCurrency: field === "destinationId",
    onCreated: (id: string) => {
      onEdit(field, id);
      onRetry();
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const summary = recordReview(
        kind,
        fields,
        { accounts, categories, sources },
      );
      setReviewError("");
      onReview(summary);
    } catch (error) {
      setReviewError(financeMessage(error));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {reviewError && (
        <p role="alert" className="record-notice">
          {reviewError}
        </p>
      )}
      {notice ? (
        <p role="alert" className="record-notice">
          {notice}
        </p>
      ) : null}

      {unavailable && !locked && (
        <RecordUnavailableAlert
          hasAccounts={accounts.length > 0}
          kind={kind}
          hasDestinations={destinations.length > 0}
          hasCategories={categories.length > 0}
        />
      )}

      <RecordFormFields
        kind={kind}
        fields={fields}
        accounts={accounts}
        categories={categories}
        sources={sources}
        account={account}
        locked={locked}
        onEdit={onEdit}
        createHelper={creationHelper}
      />

      {kind === "transfer" && (
        <div className="record-transfer-notice">
          <strong>ⓘ Transferências não contam como receita ou despesa.</strong>
          <p>Escolha contas diferentes e com a mesma moeda.</p>
        </div>
      )}

      <div className="record-actions">
        <small>* Campos obrigatórios</small>
        <Link
          className="record-cancel"
          href={backHref}
          aria-disabled={status === "saving"}
          onClick={(e) => {
            if (status === "saving") e.preventDefault();
          }}
        >
          Cancelar
        </Link>
        <button
          className="primary record-submit"
          type="submit"
          disabled={status === "saving" || (status === "ready" && unavailable)}
        >
          {status === "saving"
            ? "Salvando…"
            : kind === "income"
              ? "Revisar entrada"
              : kind === "expense"
                ? "Revisar saída"
                : "Revisar transferência"}
        </button>
      </div>
    </form>
  );
}
