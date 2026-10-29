import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { RecordKind } from "@inout/finance";
import { theme as t } from "../../theme";

export const recordTitles: Record<RecordKind, string> = {
  income: "Nova entrada",
  expense: "Nova saída",
  transfer: "Nova transferência",
};

interface RecordHeaderProps {
  kind: RecordKind;
  householdName: string;
  showReview: boolean;
  status: string;
  onBack: () => void;
}

export function RecordHeader({
  kind,
  householdName,
  showReview,
  status,
  onBack,
}: RecordHeaderProps) {
  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={s.textButton}
        onPress={onBack}
      >
        <Text style={s.link}>
          {showReview && status === "ready"
            ? `‹ ${recordTitles[kind]}`
            : "‹ Lançamentos"}
        </Text>
      </Pressable>
      <Text style={s.caption}>{householdName}</Text>
      <View
        style={[
          s.hero,
          kind === "transfer" && {
            flexDirection: "column",
            alignItems: "stretch",
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={s.title}>
            {showReview ? "Revise seu lançamento" : recordTitles[kind]}
          </Text>
          <Text style={s.help}>
            {showReview
              ? "Confira os dados antes de confirmar."
              : kind === "transfer"
                ? "Mova dinheiro entre as contas do seu lar."
                : kind === "income"
                  ? "Registre um dinheiro que entrou no seu lar."
                  : "Registre um gasto do seu lar."}
          </Text>
        </View>
        <Image
          source={
            showReview
              ? require("../../../assets/pipo-review.webp")
              : kind === "income"
                ? require("../../../assets/pipo-income-form.webp")
                : kind === "expense"
                  ? require("../../../assets/pipo-expense-form.webp")
                  : require("../../../assets/pipo-transfer-form.webp")
          }
          style={[
            s.heroArt,
            kind === "transfer" && { width: "100%", height: 140 },
          ]}
          resizeMode="contain"
          accessibilityLabel={
            showReview
              ? "Pipo revisando uma lista no caderno"
              : kind === "income"
                ? "Pipo guardando uma moeda em uma bolsinha"
                : kind === "expense"
                  ? "Pipo conferindo as compras e o recibo"
                  : "Pipo levando uma moeda pela ponte entre duas contas"
          }
        />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  textButton: { minHeight: 44, justifyContent: "center" },
  link: { fontFamily: t.sans, fontSize: 14, color: "#315f3b" },
  caption: { fontFamily: t.sans, fontSize: 11, color: t.muted },
  hero: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroArt: { width: 130, height: 130 },
  title: {
    fontFamily: t.serif,
    fontSize: 28,
    color: "#173e2b",
    marginBottom: 8,
  },
  help: { fontFamily: t.sans, fontSize: 14, color: "#4c5749", lineHeight: 21 },
});
