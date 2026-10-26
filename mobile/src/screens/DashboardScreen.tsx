import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../theme";
import {
  balances,
  currencies,
  history,
  money,
  months,
  summary,
  transactions,
  type Currency,
} from "../data/dashboard-demo";
export function DashboardScreen() {
  const [currency, setCurrency] = useState<Currency>("BRL");
  const [month, setMonth] = useState(5);
  const [picker, setPicker] = useState(false);
  const [table, setTable] = useState(false);
  const [notice, setNotice] = useState("");
  const current = summary(currency, month);
  const chart = history[currency].slice(0, month + 1);
  const max = Math.max(...chart.flatMap((row) => [row.income, row.expense]));
  function unavailable(label: string) {
    setNotice(
      `${label}: esta área ainda não está disponível nesta demonstração.`,
    );
  }
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher residência"
            onPress={() => router.push("/comecar")}
            style={s.house}
          >
            <MaterialCommunityIcons
              name="home-outline"
              size={20}
              color="#365738"
            />
            <Text style={s.small}>Nosso Ninho · exemplo</Text>
          </Pressable>
          <Text style={s.avatar}>YN</Text>
        </View>
        <View style={s.hero}>
          <View style={s.heroCopy}>
            <Text accessibilityRole="header" style={s.title}>
              Seu ninho em equilíbrio
            </Text>
            <Text style={s.subtitle}>
              Organize hoje para um amanhã mais tranquilo.
            </Text>
          </View>
          <Image
            source={require("../../assets/pipo-dashboard-hero.webp")}
            style={s.heroArt}
            resizeMode="contain"
            accessibilityLabel="Pipo sorrindo entre folhas e flores"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Período: ${months[month]} de 2026`}
          accessibilityState={{ expanded: picker }}
          onPress={() => setPicker(true)}
          style={s.period}
        >
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={18}
            color={t.muted}
          />
          <Text style={s.small}>{months[month]} de 2026</Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={18}
            color={t.muted}
          />
        </Pressable>
        <Text style={s.preview}>
          Demonstração com dados fictícios. Nenhum dado financeiro real é
          consultado.
        </Text>
        <Text accessibilityRole="header" style={s.heading}>
          Saldos por moeda
        </Text>
        <View style={s.balances}>
          {currencies.map((code) => (
            <View key={code} style={s.balance}>
              <Text style={s.small}>
                {code === "BRL" ? "🇧🇷" : "🇺🇸"} {code}
              </Text>
              <Text style={s.balanceValue}>{money(balances[code], code)}</Text>
            </View>
          ))}
        </View>
        <Text style={s.caption}>
          Saldos atuais de exemplo, sem conversão entre moedas.
        </Text>
        <View style={s.sectionHeading}>
          <Text accessibilityRole="header" style={s.heading}>
            Resumo do período
          </Text>
          <View style={s.tabs}>
            {currencies.map((code) => (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityState={{ selected: currency === code }}
                accessibilityLabel={`Resumo em ${code}`}
                style={[s.tab, currency === code && s.selected]}
                onPress={() => setCurrency(code)}
              >
                <Text style={[s.small, currency === code && s.selectedText]}>
                  {code}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {[
          {
            label: "Receitas",
            value: current.income,
            icon: "arrow-up",
            expense: false,
          },
          {
            label: "Despesas",
            value: current.expense,
            icon: "arrow-down",
            expense: true,
          },
          {
            label: "Resultado",
            value: current.result,
            icon: "equal",
            expense: false,
          },
        ].map((item) => (
          <View key={item.label} style={[s.stat, item.expense && s.expense]}>
            <MaterialCommunityIcons
              name={item.icon as "arrow-up" | "arrow-down" | "equal"}
              size={28}
              color={item.expense ? "#b84c2c" : "#507b40"}
            />
            <View>
              <Text style={s.small}>{item.label}</Text>
              <Text style={[s.statValue, item.expense && s.negative]}>
                {item.label === "Resultado" && item.value >= 0 ? "+ " : ""}
                {money(item.value, currency)}
              </Text>
            </View>
          </View>
        ))}
        <Text style={s.caption}>
          Receitas menos despesas. Transferências fora do resultado.
        </Text>
        <View style={s.panel}>
          <Text accessibilityRole="header" style={s.heading}>
            Receitas x Despesas
          </Text>
          <Text style={s.caption}>
            Verde: receitas · Terracota: despesas · {currency}
          </Text>
          <View
            accessible
            accessibilityLabel={`Gráfico em ${currency}. Os valores estão disponíveis na tabela abaixo.`}
            style={s.chart}
          >
            {chart.map((row, index) => (
              <View key={index} style={s.column}>
                <View style={s.bars}>
                  <View
                    style={[s.bar, { height: `${(row.income / max) * 100}%` }]}
                  />
                  <View
                    style={[
                      s.bar,
                      s.expenseBar,
                      { height: `${(row.expense / max) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={s.caption}>{months[index].slice(0, 3)}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: table }}
            onPress={() => setTable(!table)}
            style={s.textButton}
          >
            <Text style={s.link}>
              {table ? "Ocultar valores" : "Ver valores do gráfico"}
            </Text>
          </Pressable>
          {table
            ? chart.map((row, index) => (
                <Text key={index} style={s.tableRow}>
                  {months[index]}: receitas {money(row.income, currency)};
                  despesas {money(row.expense, currency)}.
                </Text>
              ))
            : null}
        </View>
        <View style={s.panel}>
          <View style={s.sectionHeading}>
            <Text accessibilityRole="header" style={s.heading}>
              Últimos lançamentos
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => unavailable("Lançamentos")}
              style={s.textButton}
            >
              <Text style={s.link}>Ver todos</Text>
            </Pressable>
          </View>
          {transactions(currency, month).map((row) => (
            <View key={row.name} style={s.transaction}>
              <View style={s.transactionCopy}>
                <Text style={s.small}>{row.name}</Text>
                <Text style={s.caption}>
                  {row.category} · {row.day} de {months[month].slice(0, 3)}.
                </Text>
              </View>
              <Text style={[s.amount, row.cents < 0 && s.negative]}>
                {row.cents > 0 ? "+ " : "− "}
                {money(Math.abs(row.cents), currency)}
              </Text>
            </View>
          ))}
          <Text style={s.caption}>
            Amostra; esta lista não representa o total do período.
          </Text>
        </View>
        <Text accessibilityRole="header" style={s.heading}>
          Ações rápidas
        </Text>
        {["Registrar entrada", "Registrar saída", "Transferir"].map(
          (label, index) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              style={[s.action, index === 1 && s.expense]}
              onPress={() => unavailable(label)}
            >
              <MaterialCommunityIcons
                name={index === 2 ? "swap-horizontal" : "plus-circle-outline"}
                size={22}
                color={index === 1 ? "#b84c2c" : "#365738"}
              />
              <Text style={s.small}>{label}</Text>
            </Pressable>
          ),
        )}
        <Text accessibilityLiveRegion="polite" style={s.notice}>
          {notice}
        </Text>
      </ScrollView>
      <View style={s.bottom}>
        {[
          { name: "Início", icon: "home" },
          { name: "Lançamentos", icon: "receipt-text-outline" },
          { name: "Contas", icon: "wallet-outline" },
          { name: "Mais", icon: "dots-horizontal" },
        ].map((item, index) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: index === 0 }}
            key={item.name}
            style={s.navButton}
            onPress={() =>
              index === 0 ? setNotice("") : unavailable(item.name)
            }
          >
            <MaterialCommunityIcons
              name={
                item.icon as
                  | "home"
                  | "wallet-outline"
                  | "receipt-text-outline"
                  | "dots-horizontal"
              }
              size={24}
              color={index === 0 ? "#365738" : t.muted}
            />
            <Text style={s.navText}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={picker}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(false)}
      >
        <View style={s.backdrop}>
          <View style={s.modal} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={s.heading}>
              Período de 2026
            </Text>
            <ScrollView>
              {months.map((name, index) => (
                <Pressable
                  key={name}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: month === index }}
                  style={s.monthOption}
                  onPress={() => {
                    setMonth(index);
                    setPicker(false);
                  }}
                >
                  <Text style={s.small}>{name} de 2026</Text>
                  {month === index ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={22}
                      color={t.green}
                    />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              style={s.textButton}
              onPress={() => setPicker(false)}
            >
              <Text style={s.link}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    padding: 16,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 20,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  house: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  avatar: {
    backgroundColor: "#dfe5cd",
    padding: 10,
    borderRadius: 24,
    color: "#365738",
    fontFamily: t.sans,
    fontSize: 12,
  },
  hero: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  heroCopy: { width: "57%" },
  heroArt: { width: "43%", height: 130 },
  title: {
    fontFamily: t.serif,
    fontSize: 27,
    lineHeight: 32,
    color: "#183d2b",
  },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: t.muted,
    marginTop: 8,
  },
  small: { fontFamily: t.sans, fontSize: 12, color: "#183d2b" },
  period: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 20,
    paddingHorizontal: 12,
    minHeight: 44,
    alignSelf: "flex-start",
    marginVertical: 12,
  },
  preview: {
    fontFamily: t.sans,
    fontSize: 10,
    lineHeight: 16,
    color: t.muted,
    marginBottom: 8,
  },
  heading: {
    fontFamily: t.serif,
    fontSize: 18,
    color: "#183d2b",
    marginVertical: 12,
  },
  balances: { flexDirection: "row", gap: 8 },
  balance: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fffcf4",
  },
  balanceValue: {
    fontFamily: t.serif,
    fontSize: 20,
    color: "#183d2b",
    marginTop: 8,
  },
  caption: {
    fontFamily: t.sans,
    fontSize: 10,
    lineHeight: 16,
    color: t.muted,
    marginTop: 5,
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#eee8da",
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  selected: { backgroundColor: "#416942" },
  selectedText: { color: "white" },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 12,
    backgroundColor: "#edf0dd",
    borderWidth: 1,
    borderColor: "#dce1c6",
    borderRadius: 12,
    marginBottom: 7,
  },
  statValue: {
    fontFamily: t.serif,
    fontSize: 23,
    color: "#285433",
    marginTop: 3,
  },
  expense: { backgroundColor: "#fbe9df", borderColor: "#f1d4c4" },
  negative: { color: "#b24429" },
  panel: {
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  chart: { height: 160, flexDirection: "row", gap: 10, paddingTop: 10 },
  column: { flex: 1, alignItems: "center" },
  bars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    width: "100%",
  },
  bar: {
    flex: 1,
    backgroundColor: "#5c805c",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  expenseBar: { backgroundColor: "#d77e5f" },
  textButton: { minHeight: 44, justifyContent: "center" },
  link: {
    fontFamily: t.sans,
    fontSize: 11,
    color: "#365738",
    textDecorationLine: "underline",
  },
  tableRow: {
    fontFamily: t.sans,
    fontSize: 11,
    lineHeight: 18,
    color: t.ink,
    paddingVertical: 6,
  },
  transaction: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  transactionCopy: { flex: 1 },
  amount: { fontFamily: t.sans, fontSize: 11, color: "#285433" },
  action: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#edf0dd",
    borderRadius: 10,
    marginBottom: 8,
  },
  notice: {
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 19,
    color: t.muted,
    marginTop: 10,
  },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderColor: t.line,
    paddingVertical: 7,
    backgroundColor: "#fffcf4",
  },
  navButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navText: { fontFamily: t.sans, fontSize: 10, color: "#365738" },
  backdrop: {
    flex: 1,
    backgroundColor: "#32291e99",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: t.cream,
    padding: 24,
    borderRadius: 20,
    maxWidth: 480,
    width: "100%",
    maxHeight: "80%",
    alignSelf: "center",
  },
  monthOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
