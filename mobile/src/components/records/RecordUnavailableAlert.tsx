import React from "react";
import { StyleSheet, Text } from "react-native";
import type { RecordKind } from "@inout/finance";
import { theme as t } from "../../theme";

interface RecordUnavailableAlertProps {
  unavailable: boolean;
  locked: boolean;
  accountsLength: number;
  kind: RecordKind;
}

export function RecordUnavailableAlert({
  unavailable,
  locked,
  accountsLength,
  kind,
}: RecordUnavailableAlertProps) {
  if (!unavailable || locked) return null;

  const message = !accountsLength
    ? "Crie uma conta financeira antes de registrar."
    : kind === "transfer"
      ? "Uma transferência precisa de duas contas diferentes na mesma moeda."
      : "Cadastre uma categoria correspondente a este tipo de movimentação antes de registrar.";

  return (
    <Text accessibilityRole="alert" style={s.notice}>
      {message}
    </Text>
  );
}

const s = StyleSheet.create({
  notice: {
    fontFamily: t.sans,
    fontSize: 14,
    color: "#9b4229",
    lineHeight: 21,
    marginVertical: 10,
  },
});
