"use client";

import type { RecordKind } from "@inout/finance";

interface RecordUnavailableAlertProps {
  hasAccounts: boolean;
  kind: RecordKind;
  hasDestinations: boolean;
  hasCategories: boolean;
}

export function RecordUnavailableAlert({
  hasAccounts,
  kind,
  hasDestinations,
  hasCategories,
}: RecordUnavailableAlertProps) {
  if (!hasAccounts) {
    return <p role="alert">Crie uma conta financeira antes de registrar.</p>;
  }

  if (kind === "transfer" && !hasDestinations) {
    return (
      <p role="alert">
        Uma transferência precisa de duas contas diferentes na mesma moeda.
      </p>
    );
  }

  if (kind !== "transfer" && !hasCategories) {
    return (
      <p role="alert">
        Cadastre uma categoria correspondente a este tipo de movimentação antes
        de registrar.
      </p>
    );
  }

  return null;
}
