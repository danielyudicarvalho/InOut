import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  money,
  type RecordKind,
  type RecordFields,
  type RecordReview,
} from "@inout/finance";
import { theme as t } from "../theme";
export function RecordReviewPanel({
  kind,
  summary,
  status,
  notice,
  onEdit,
  onConfirm,
}: {
  kind: RecordKind;
  summary: RecordReview | null;
  status: string;
  notice: string;
  onEdit: (field?: keyof RecordFields) => void;
  onConfirm: () => void;
}) {
  const pending = status === "uncertain",
    saving = status === "saving",
    noun =
      kind === "expense"
        ? "saída"
        : kind === "income"
          ? "entrada"
          : "transferência";
  return (
    <View style={s.card}>
      <Text style={s.label}>Resumo da {noun}</Text>
      {summary && (
        <Text style={[s.amount, kind === "expense" && { color: "#bd5339" }]}>
          {money(summary.amount, summary.currency)}
        </Text>
      )}
      <Text accessibilityLiveRegion="polite" style={s.badge}>
        {pending
          ? "Confirmação pendente"
          : saving
            ? "Registrando…"
            : "Ainda não registrado"}
      </Text>
      {notice && (
        <Text accessibilityRole="alert" style={s.notice}>
          {notice}
        </Text>
      )}
      {summary ? (
        summary.rows.map((row, i) => (
          <View style={s.row} key={i}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{row.label}</Text>
              <Text selectable style={s.value}>
                {row.value}
              </Text>
            </View>
            {row.field && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Editar ${row.label}`}
                disabled={saving || pending}
                style={s.edit}
                onPress={() => onEdit(row.field!)}
              >
                <Text style={s.editText}>✎ Editar</Text>
              </Pressable>
            )}
          </View>
        ))
      ) : (
        <Text>
          Não foi possível montar o resumo com os catálogos atuais. A tentativa
          anterior continua protegida.
        </Text>
      )}
      <Text style={s.info}>
        {pending
          ? "O resultado anterior ainda não foi confirmado. Verifique usando a mesma tentativa."
          : kind === "transfer"
            ? "Ao confirmar, o valor será movido entre as contas. Transferências não contam como receita ou despesa."
            : `Ao confirmar, esta ${noun} será registrada na conta escolhida.`}
      </Text>
      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={saving || pending}
          style={[s.button, (saving || pending) && s.disabled]}
          onPress={() => onEdit()}
        >
          <Text style={s.editText}>Editar dados</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: saving, disabled: saving }}
          disabled={saving}
          style={[
            s.button,
            s.confirm,
            kind === "expense" && { backgroundColor: "#bc5239" },
          ]}
          onPress={onConfirm}
        >
          <Text style={{ color: "white" }}>
            {saving
              ? "Registrando…"
              : pending
                ? "Verificar tentativa pendente"
                : `Confirmar ${noun}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 18,
    backgroundColor: "#fffdf5",
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 16,
    gap: 12,
  },
  label: { fontFamily: t.sans, fontSize: 12, color: t.muted },
  amount: { fontFamily: t.serif, fontSize: 29, color: "#275c3e" },
  badge: {
    fontSize: 11,
    color: "#896322",
    backgroundColor: "#f9edca",
    padding: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: t.line,
    paddingTop: 12,
  },
  value: { fontFamily: t.sans, color: t.ink, fontSize: 14, lineHeight: 21 },
  edit: { padding: 10, minHeight: 44, justifyContent: "center" },
  editText: { color: "#315f3b", fontSize: 13 },
  info: {
    backgroundColor: "#f7efda",
    padding: 12,
    borderRadius: 8,
    color: t.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  notice: { color: "#9b4229", lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    flexGrow: 1,
    padding: 12,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#63836b",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  confirm: { backgroundColor: "#315f3b" },
  disabled: { opacity: 0.45 },
});
