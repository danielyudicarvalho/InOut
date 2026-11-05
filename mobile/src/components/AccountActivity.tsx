import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { displayDate, historyKind, money } from "@inout/finance";
import { useLedgerHistory } from "../finance/use-ledger-history";
import { PeriodPicker } from "./PeriodPicker";
import { theme as t } from "../theme";
export function AccountActivity({
  household,
  period,
  accountId,
  currency,
  hidden,
  onPeriod,
}: {
  household: string;
  period: string;
  accountId: string;
  currency: string;
  hidden: boolean;
  onPeriod: (value: string) => void;
}) {
  const history = useLedgerHistory(household, period, { accountId }, 0);
  const [picker, setPicker] = useState(false);
  const params = { household, period, accountId, currency };
  return (
    <View style={s.section}>
      <View style={s.actions}>
        {[
          ["income", "＋ Entrada"],
          ["expense", "− Saída"],
          ["transfer", "⇄ Transferência"],
        ].map(([kind, label]) => (
          <Pressable
            accessibilityRole="button"
            key={kind}
            style={s.button}
            onPress={() =>
              router.push({
                pathname: "/novo-registro",
                params: { ...params, kind },
              })
            }
          >
            <Text style={s.link}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text accessibilityRole="header" style={s.heading}>
        Movimentações do período
      </Text>
      <Pressable
        accessibilityRole="button"
        style={s.button}
        onPress={() => setPicker(true)}
      >
        <Text style={s.link}>Selecionar período</Text>
      </Pressable>
      {history.loading ? (
        <Text accessibilityLiveRegion="polite">Carregando movimentações…</Text>
      ) : history.error ? (
        <View>
          <Text accessibilityLiveRegion="assertive">{history.error}</Text>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={history.retry}
          >
            <Text>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : history.items.length === 0 ? (
        <Text style={s.help}>
          Nenhuma movimentação nesta conta no período selecionado.
        </Text>
      ) : (
        history.items.slice(0, 5).map((item, index) => (
          <Pressable
            accessibilityRole="button"
            key={`${item.transactionId}:${index}`}
            style={s.item}
            onPress={() =>
              router.push({
                pathname: "/lancamento",
                params: { ...params, transaction: item.transactionId },
              })
            }
          >
            <Text style={s.heading}>{item.description}</Text>
            <Text style={s.help}>
              {displayDate(item.date)} · {historyKind(item)} ·{" "}
              {item.status === "reversed" ? "Estornado" : "Registrado"}
            </Text>
            <Text style={s.help}>
              {item.category}
              {item.source ? ` · ${item.source}` : ""}
            </Text>
            <Text style={s.link}>
              {hidden ? "••••" : money(item.amount, item.currency)} ›
            </Text>
          </Pressable>
        ))
      )}
      <Pressable
        accessibilityRole="button"
        style={s.button}
        onPress={() => router.push({ pathname: "/lancamentos", params })}
      >
        <Text style={s.link}>Ver extrato completo →</Text>
      </Pressable>
      {picker ? (
        <PeriodPicker
          value={period}
          onClose={() => setPicker(false)}
          onApply={(value) => {
            onPeriod(value);
            setPicker(false);
          }}
        />
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: 14, marginTop: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#e8eddc",
    justifyContent: "center",
  },
  link: { color: "#355d41", fontFamily: t.sans },
  heading: { fontFamily: t.serif, color: "#244735", fontSize: 18 },
  help: { fontFamily: t.sans, color: t.muted, lineHeight: 21 },
  item: {
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
});
