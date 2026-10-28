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
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../theme";
import { money, periodLabel, dashboardSetupState } from "@inout/finance";
import { NewRecordPicker } from "../components/NewRecordPicker";
import { PeriodPicker } from "../components/PeriodPicker";
import { DashboardSetupScreen } from "./DashboardSetupScreen";
import { useFinancialHome } from "../finance/use-financial-home";

export function DashboardScreen() {
  const p = useLocalSearchParams();
  const household = typeof p.household === "string" ? p.household : "",
    period = typeof p.period === "string" ? p.period : "",
    currency = typeof p.currency === "string" ? p.currency : "";
  return (
    <DashboardView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function DashboardView({
  initialCurrency,
  ...options
}: {
  initialHouseholdId: string;
  initialPeriod: string;
  initialCurrency: string;
}) {
  const state = useFinancialHome(options);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [chosenCurrency, setCurrency] = useState(initialCurrency);
  const [picker, setPicker] = useState<"household" | null>(null);
  const [table, setTable] = useState(false);
  const [notice, setNotice] = useState("");
  const setup = state.data ? dashboardSetupState(state.data) : "active";
  if (state.status === "ready" && state.data && setup !== "active")
    return (
      <DashboardSetupScreen
        mode={setup}
        data={state.data}
        households={state.households}
        householdId={state.householdId}
        period={state.period}
        currency={chosenCurrency}
        onCurrency={setCurrency}
        onHousehold={state.selectHousehold}
        onRefresh={state.retry}
      />
    );
  if (
    state.status !== "ready" ||
    !state.data ||
    !state.data.currencies.length
  ) {
    const empty =
      state.status === "empty" ||
      (state.status === "ready" && !state.data?.currencies.length);
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.content}>
          <Text accessibilityRole="header" style={s.title}>
            Seu ninho em equilíbrio
          </Text>
          <Text accessibilityLiveRegion="polite" style={s.subtitle}>
            {state.status === "loading"
              ? "Carregando suas finanças…"
              : empty
                ? state.households.length
                  ? "Esta residência ainda não possui contas financeiras."
                  : "Você ainda não participa de uma residência."
                : state.notice}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.period}
            onPress={() => setPeriodOpen(true)}
          >
            <Text style={s.small}>{periodLabel(state.period)}</Text>
          </Pressable>
          {periodOpen ? (
            <PeriodPicker
              value={state.period}
              onClose={() => setPeriodOpen(false)}
              onApply={(value) => {
                setPeriodOpen(false);
                state.selectPeriod(value);
              }}
            />
          ) : null}
          {state.status !== "loading" ? (
            <Pressable
              accessibilityRole="button"
              style={s.action}
              onPress={state.retry}
            >
              <Text style={s.small}>Atualizar residências</Text>
            </Pressable>
          ) : null}
          {state.households.length > 1
            ? state.households.map((h) => (
                <Pressable
                  key={h.id}
                  accessibilityRole="button"
                  style={s.action}
                  onPress={() => state.selectHousehold(h.id)}
                >
                  <Text style={s.small}>{h.name}</Text>
                </Pressable>
              ))
            : null}
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => router.replace("/comecar")}
          >
            <Text style={s.link}>Escolher como começar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => router.replace("/entrar")}
          >
            <Text style={s.link}>Ir para entrar</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }
  const data = state.data;
  const currencies = data.currencies;
  const currency = currencies.includes(chosenCurrency)
    ? chosenCurrency
    : currencies[0];
  const current = data.summaries.find((row) => row.currency === currency)!;
  const chart = data.history.map((row) => ({
    period: row.period,
    ...(row.summaries.find((v) => v.currency === currency) ?? {
      income: 0,
      expense: 0,
    }),
  }));
  const max = Math.max(1, ...chart.flatMap((row) => [row.income, row.expense]));
  const hasNegative = chart.some((row) => row.income < 0 || row.expense < 0);
  const rows = data.transactions.slice(0, 4);
  const household = state.households.find((h) => h.id === state.householdId)!;
  function unavailable(label: string) {
    if (label === "Lançamentos") {
      router.push({
        pathname: "/lancamentos",
        params: {
          household: state.householdId,
          period: state.period,
          currency: chosenCurrency,
        },
      });
      return;
    }
    setNotice(`${label}: esta área ainda não está disponível no aplicativo.`);
  }
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher residência"
            onPress={() => setPicker("household")}
            style={s.house}
          >
            <MaterialCommunityIcons
              name="home-outline"
              size={20}
              color="#365738"
            />
            <Text style={s.small}>{household.name}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Novo registro"
            onPress={() => setRecordOpen(true)}
            style={s.textButton}
          >
            <MaterialCommunityIcons
              name="plus-circle"
              size={34}
              color={t.green}
            />
          </Pressable>
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
          accessibilityLabel={`Período: ${periodLabel(state.period)}`}
          accessibilityState={{ expanded: periodOpen }}
          onPress={() => setPeriodOpen(true)}
          style={s.period}
        >
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={18}
            color={t.muted}
          />
          <Text style={s.small}>{periodLabel(state.period)}</Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={18}
            color={t.muted}
          />
        </Pressable>
        {!data.isReconciled ? (
          <Text accessibilityLiveRegion="assertive" style={s.notice}>
            O backend identificou uma divergência na conciliação. Confira os
            lançamentos antes de usar estes totais.
          </Text>
        ) : null}
        <Text accessibilityRole="header" style={s.heading}>
          Saldos por moeda
        </Text>
        <View style={s.balances}>
          {currencies.map((code) => (
            <Pressable
              key={code}
              style={s.balance}
              accessibilityRole="button"
              accessibilityLabel={`Ver composição em ${code}`}
              onPress={() =>
                router.push({
                  pathname: "/composicao-saldo",
                  params: {
                    household: state.householdId,
                    period: state.period,
                    currency: code,
                  },
                })
              }
            >
              <Text style={s.small}>
                {code === "BRL" ? "🇧🇷" : code === "USD" ? "🇺🇸" : "💱"} {code}
              </Text>
              <Text style={s.balanceValue}>
                {money(
                  data.summaries.find((row) => row.currency === code)!.balance,
                  code,
                )}
              </Text>
              <Text style={s.caption}>Ver composição ›</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.caption}>
          Saldos até {data.periodEnd.split("-").reverse().join("/")}, sem
          conversão entre moedas.
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
              {item.label === "Receitas" ||
              item.label === "Despesas" ||
              item.label === "Resultado" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ver detalhamento de ${item.label.toLowerCase()}`}
                  onPress={() =>
                    router.push({
                      pathname:
                        item.label === "Receitas"
                          ? "/receitas"
                          : item.label === "Despesas"
                            ? "/despesas"
                            : "/resultado",
                      params: {
                        household: state.householdId,
                        period: state.period,
                        currency,
                      },
                    })
                  }
                >
                  <Text style={s.caption}>
                    Ver {item.label.toLowerCase()} ›
                  </Text>
                </Pressable>
              ) : null}
              {item.label === "Receitas" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver receitas por fonte de renda"
                  onPress={() =>
                    router.push({
                      pathname: "/fontes-renda",
                      params: {
                        household: state.householdId,
                        period: state.period,
                        currency,
                      },
                    })
                  }
                >
                  <Text style={s.caption}>Ver por fonte de renda ›</Text>
                </Pressable>
              ) : null}
              {item.label === "Despesas" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver despesas por categoria"
                  onPress={() =>
                    router.push({
                      pathname: "/resumo-categorias",
                      params: {
                        household: state.householdId,
                        period: state.period,
                        currency,
                      },
                    })
                  }
                >
                  <Text style={s.caption}>Ver por categoria ›</Text>
                </Pressable>
              ) : null}
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
          {hasNegative ? (
            <Text style={s.caption}>
              Há ajustes negativos no histórico. Consulte os valores abaixo.
            </Text>
          ) : (
            <View
              accessible
              accessibilityLabel={`Gráfico em ${currency}. Os valores estão disponíveis na tabela abaixo.`}
              style={s.chart}
            >
              {chart.map((row, index) => (
                <View key={index} style={s.column}>
                  <View style={s.bars}>
                    <View
                      style={[
                        s.bar,
                        { height: `${(row.income / max) * 100}%` },
                      ]}
                    />
                    <View
                      style={[
                        s.bar,
                        s.expenseBar,
                        { height: `${(row.expense / max) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={s.caption}>
                    {row.period.includes("/")
                      ? "Intervalo"
                      : row.period.slice(5) + "/" + row.period.slice(2, 4)}
                  </Text>
                </View>
              ))}
            </View>
          )}
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
          {table || hasNegative
            ? chart.map((row, index) => (
                <Text key={index} style={s.tableRow}>
                  {periodLabel(row.period)}: receitas{" "}
                  {money(row.income, currency)}; despesas{" "}
                  {money(row.expense, currency)}.
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
          {rows.length === 0 ? (
            <Text style={s.caption}>Nenhum lançamento no período.</Text>
          ) : null}
          {rows.map((row) => (
            <View key={row.id} style={s.transaction}>
              <View style={s.transactionCopy}>
                <Text style={s.small}>{row.name}</Text>
                <Text style={s.caption}>
                  {row.category} · {row.date.split("-").reverse().join("/")}
                </Text>
              </View>
              <Text style={[s.amount, row.cents < 0 && s.negative]}>
                {row.cents > 0 ? "+ " : "− "}
                {money(Math.abs(row.cents), row.currency)}
              </Text>
            </View>
          ))}
          <Text style={s.caption}>
            Últimos registros do período, na moeda de cada conta. Transferências
            podem ter um registro por conta.
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
              onPress={() =>
                router.push({
                  pathname: "/novo-registro",
                  params: {
                    household: state.householdId,
                    period: state.period,
                    currency,
                    kind:
                      index === 0
                        ? "income"
                        : index === 1
                          ? "expense"
                          : "transfer",
                  },
                })
              }
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
          { name: "Novo", icon: "plus-circle" },
          { name: "Contas", icon: "wallet-outline" },
          { name: "Mais", icon: "dots-horizontal" },
        ].map((item, index) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: index === 0 }}
            key={item.name}
            style={s.navButton}
            onPress={() =>
              index === 0
                ? setNotice("")
                : item.name === "Novo"
                  ? setRecordOpen(true)
                  : unavailable(item.name)
            }
          >
            <MaterialCommunityIcons
              name={
                item.icon as
                  | "home"
                  | "plus-circle"
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
      {recordOpen ? (
        <NewRecordPicker
          household={state.householdId}
          period={state.period}
          currency={currency}
          onClose={() => setRecordOpen(false)}
        />
      ) : null}
      {periodOpen ? (
        <PeriodPicker
          value={state.period}
          onClose={() => setPeriodOpen(false)}
          onApply={(value) => {
            setPeriodOpen(false);
            state.selectPeriod(value);
          }}
        />
      ) : null}
      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={s.backdrop}>
          <View style={s.modal} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={s.heading}>
              Residência
            </Text>
            <ScrollView>
              {state.households.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: state.householdId === item.id,
                  }}
                  style={s.monthOption}
                  onPress={() => {
                    state.selectHousehold(item.id);
                    setPicker(null);
                  }}
                >
                  <Text style={s.small}>{item.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              style={s.textButton}
              onPress={() => setPicker(null)}
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
