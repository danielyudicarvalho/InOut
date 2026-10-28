import { Image, Pressable, Text, View, StyleSheet } from "react-native";
import { money, type RecordKind, type RecordReview } from "@inout/finance";
import { theme as t } from "../theme";
export function RecordSaved({
  kind,
  summary,
  description,
  transactionId,
  onDetails,
  onHistory,
  onNew,
}: {
  kind: RecordKind;
  summary: RecordReview | null;
  description: string;
  transactionId: string;
  onDetails: () => void;
  onHistory: () => void;
  onNew: () => void;
}) {
  const rows =
    summary?.rows.filter(
      (row) => !["Descrição", "Subcategoria"].includes(row.label),
    ) ?? [];
  return (
    <View nativeID={`saved-${transactionId}`} style={s.panel}>
      <Image
        source={require("../../assets/pipo-saved.webp")}
        style={s.art}
        accessibilityLabel="Pipo carimbando um caderno com uma marca de confirmação"
      />
      <Text style={s.check} accessibilityElementsHidden>
        ✓
      </Text>
      <Text accessibilityRole="header" style={s.title}>
        {kind === "expense"
          ? "Saída registrada!"
          : kind === "income"
            ? "Entrada registrada!"
            : "Transferência registrada!"}
      </Text>
      <Text accessibilityLiveRegion="polite" style={s.help}>
        Seu lançamento foi salvo no Ninho.
      </Text>
      <View style={s.card}>
        <View style={s.header}>
          <Text style={s.description}>
            {description.trim() || "Sem descrição"}
          </Text>
          <Text style={s.badge}>● Registrado</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Tipo</Text>
          <Text style={s.value}>
            {kind === "income"
              ? "Entrada"
              : kind === "expense"
                ? "Saída"
                : "Transferência"}
          </Text>
        </View>
        {summary && (
          <View style={s.row}>
            <Text style={s.label}>Valor</Text>
            <Text
              style={[
                s.value,
                {
                  color: kind === "expense" ? "#bc5239" : "#315f3b",
                  fontWeight: "700",
                },
              ]}
            >
              {money(summary.amount, summary.currency)}
            </Text>
          </View>
        )}
        {rows.map((row) => (
          <View key={row.label} style={s.row}>
            <Text style={s.label}>{row.label}</Text>
            <Text style={s.value}>
              {row.value}
              {row.label === "Categoria" &&
              summary?.rows.some((r) => r.label === "Subcategoria")
                ? ` › ${summary.rows.find((r) => r.label === "Subcategoria")?.value}`
                : ""}
            </Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        style={s.primary}
        onPress={onDetails}
      >
        <Text style={s.white}>▤ Ver lançamento</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={s.secondary} onPress={onNew}>
        <Text style={s.green}>⊕ Novo registro</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={s.link} onPress={onHistory}>
        <Text style={s.green}>Voltar ao histórico</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  panel: { gap: 10, paddingVertical: 12 },
  art: { width: "100%", height: 175, resizeMode: "contain" },
  check: {
    alignSelf: "center",
    backgroundColor: "#527948",
    color: "white",
    borderRadius: 24,
    fontSize: 28,
    width: 48,
    height: 48,
    textAlign: "center",
    lineHeight: 48,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 27,
    color: "#1e4933",
    textAlign: "center",
  },
  help: {
    fontFamily: t.sans,
    color: t.muted,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    backgroundColor: "#fffdf5",
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  description: { flex: 1, fontFamily: t.sans, color: t.ink, fontWeight: "700" },
  badge: {
    fontSize: 10,
    color: "#315f3b",
    padding: 6,
    backgroundColor: "#e8ecdc",
    borderRadius: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    borderTopWidth: 1,
    borderColor: t.line,
    paddingTop: 8,
  },
  label: { fontSize: 12, color: t.muted, flex: 1 },
  value: { fontSize: 12, color: t.ink, flex: 2, textAlign: "right" },
  id: { fontSize: 10, color: t.muted },
  primary: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#315f3b",
    alignItems: "center",
  },
  secondary: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#ecebd9",
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.line,
  },
  link: { padding: 14, alignItems: "center" },
  white: { color: "white", fontFamily: t.sans },
  green: { color: "#315f3b", fontFamily: t.sans },
});
