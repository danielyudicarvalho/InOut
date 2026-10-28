import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  displayDate,
  historyKind,
  money,
  reversalReconciliation,
  type TransactionDetail,
} from "@inout/finance";
import { theme as t } from "../theme";

export function ReversalDetail({
  detail,
  original,
  onOriginal,
  onBack,
}: {
  detail: TransactionDetail;
  original: TransactionDetail;
  onOriginal: () => void;
  onBack: () => void;
}) {
  const effects = reversalReconciliation(detail, original);
  const signed = (amount: number, currency: string) =>
    `${amount > 0 ? "+ " : amount < 0 ? "− " : ""}${money(Math.abs(amount), currency)}`;
  return (
    <>
      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={s.title}>
            Detalhe do estorno
          </Text>
          <Text style={s.help}>
            Uma correção vinculada ao lançamento original.
          </Text>
        </View>
        <Image
          accessible={false}
          source={require("../../assets/pipo-reversal.webp")}
          style={s.art}
        />
      </View>
      <View style={s.card}>
        <View style={s.summary}>
          <MaterialCommunityIcons
            name="cart-outline"
            size={30}
            color="#ac5437"
            accessible={false}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>Estorno de {original.description}</Text>
            <View style={s.badges}>
              <Text style={s.badge}>Estorno</Text>
              <Text style={[s.badge, s.registered]}>Registrado</Text>
            </View>
          </View>
        </View>
        <Text style={s.help}>
          {detail.postings.map((p) => p.accountName).join(" · ")} ·{" "}
          {detail.currency}
        </Text>
        {effects.length === 1 && (
          <View style={s.compensation}>
            <Text style={s.help}>Compensação na conta</Text>
            <Text
              style={[
                s.amount,
                { color: detail.amount < 0 ? "#ad432c" : "#2b6b42" },
              ]}
            >
              {signed(detail.amount, detail.currency)}
            </Text>
          </View>
        )}
        <View style={s.info}>
          <MaterialCommunityIcons
            name="information"
            size={18}
            color="#527445"
            accessible={false}
          />
          <Text style={s.infoText}>
            {effects.length > 1
              ? "Este estorno compensa os dois lados da transferência."
              : original.amount < 0
                ? "Este valor compensa a saída original. Não é uma nova receita."
                : "Este valor compensa a entrada original. Não é uma nova despesa."}
          </Text>
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Lançamento original</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver lançamento original"
          onPress={onOriginal}
          style={s.original}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.value}>{original.description}</Text>
            <Text style={s.help}>
              {historyKind({ kind: original.kind })} ·{" "}
              {displayDate(original.date)}
            </Text>
          </View>
          <View>
            <Text
              style={[
                s.value,
                { color: original.amount < 0 ? "#ad432c" : "#2b6b42" },
              ]}
            >
              {signed(original.amount, original.currency)}
            </Text>
            <Text style={s.badge}>Estornado</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color="#315f3b"
            accessible={false}
          />
        </Pressable>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Conciliação do estorno</Text>
        {effects.map((effect) => (
          <View key={effect.accountId} style={s.effect}>
            {effects.length > 1 && (
              <Text style={s.value}>
                {effect.accountName} · {effect.currency}
              </Text>
            )}
            {[
              {
                label:
                  effect.original < 0 ? "Saída original" : "Entrada original",
                amount: effect.original,
              },
              { label: "Compensação", amount: effect.compensation },
              { label: "Efeito líquido", amount: effect.net },
            ].map((row, i) => (
              <View key={row.label} style={s.equationRow}>
                <MaterialCommunityIcons
                  name={
                    i === 0
                      ? "minus-circle"
                      : i === 1
                        ? "plus-circle"
                        : "equal-box"
                  }
                  size={20}
                  color={i === 0 ? "#ae583c" : "#527445"}
                  accessible={false}
                />
                <Text style={[s.help, { flex: 1 }]}>{row.label}</Text>
                <Text
                  style={[
                    s.value,
                    {
                      color:
                        row.amount < 0
                          ? "#ad432c"
                          : row.amount > 0
                            ? "#2b6b42"
                            : t.ink,
                    },
                  ]}
                >
                  {signed(row.amount, effect.currency)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Detalhes do estorno</Text>
        <Text style={s.help}>Data do estorno</Text>
        <Text style={s.value}>{displayDate(detail.date)}</Text>
        <Text style={s.help}>Motivo</Text>
        <Text style={s.value}>
          {detail.rawDescription || "Motivo não informado"}
        </Text>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Auditoria</Text>
        <Text style={s.help}>Estornado por (usuário)</Text>
        <Text selectable style={s.value}>
          {detail.createdBy}
        </Text>
        <Text style={s.help}>Registrado em</Text>
        <Text style={s.value}>
          {new Date(detail.postedAt).toLocaleString("pt-BR")}
        </Text>
        <Text style={s.help}>Horário do dispositivo</Text>
      </View>
      <View style={s.info}>
        <MaterialCommunityIcons
          name="information"
          size={18}
          color="#527445"
          accessible={false}
        />
        <Text style={s.infoText}>
          O lançamento original permanece no histórico.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        style={[s.button, s.primary]}
        onPress={onOriginal}
      >
        <MaterialCommunityIcons
          name="open-in-new"
          size={18}
          color="white"
          accessible={false}
        />
        <Text style={s.primaryLabel}>Ver lançamento original</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={s.button} onPress={onBack}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={18}
          color="#315f3b"
          accessible={false}
        />
        <Text style={s.value}>Voltar ao histórico</Text>
      </Pressable>
    </>
  );
}
const s = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: t.serif, fontSize: 25, color: "#214b36" },
  art: { width: 105, height: 110, resizeMode: "contain" },
  card: {
    backgroundColor: "#fffdf5",
    padding: 15,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: t.line,
    gap: 9,
  },
  heading: { fontFamily: t.serif, fontSize: 17, color: "#214b36" },
  summary: { flexDirection: "row", alignItems: "center", gap: 12 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 8 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#f6e1cd",
    color: "#934329",
    fontSize: 11,
  },
  registered: { backgroundColor: "#e7ebd9", color: "#315f3b" },
  help: { fontFamily: t.sans, fontSize: 11, lineHeight: 17, color: t.muted },
  value: {
    fontFamily: t.sans,
    fontSize: 13,
    lineHeight: 20,
    color: t.ink,
    flexShrink: 1,
  },
  compensation: { alignItems: "center", gap: 2 },
  amount: { fontFamily: t.serif, fontSize: 27 },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#eeeedf",
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontFamily: t.sans,
    fontSize: 12,
    color: "#315339",
    lineHeight: 18,
  },
  original: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: "#f5f0e5",
    borderRadius: 9,
    minHeight: 60,
  },
  effect: { gap: 5, backgroundColor: "#f5f0e5", padding: 10, borderRadius: 9 },
  equationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  button: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 9,
    backgroundColor: "#fffdf5",
  },
  primary: { backgroundColor: "#315f3b" },
  primaryLabel: { fontFamily: t.sans, fontSize: 13, color: "white" },
});
