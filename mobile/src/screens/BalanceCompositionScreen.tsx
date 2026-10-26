import { useRef, useState, type ComponentRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  accountKindLabel,
  balanceComposition,
  money,
  periodLabel,
} from "@inout/finance";
import { useFinancialHome } from "../finance/use-financial-home";
import { theme as t } from "../theme";
export function BalanceCompositionScreen() {
  const p = useLocalSearchParams();
  const household = typeof p.household === "string" ? p.household : "",
    period = typeof p.period === "string" ? p.period : "",
    currency = typeof p.currency === "string" ? p.currency : "";
  return (
    <BalanceView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function BalanceView({
  initialCurrency,
  ...options
}: {
  initialHouseholdId: string;
  initialPeriod: string;
  initialCurrency: string;
}) {
  const state = useFinancialHome(options);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [chosen, setCurrency] = useState(initialCurrency),
    [hidden, setHidden] = useState(false),
    [accountId, setAccount] = useState<string | null>(null);
  const back = () =>
    router.replace({
      pathname: "/inicio",
      params: {
        household: state.householdId,
        period: state.period,
        currency: chosen,
      },
    });
  if (state.status !== "ready" || !state.data || !state.data.currencies.length)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text accessibilityRole="header" style={s.title}>
            Composição do saldo
          </Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {state.status === "loading"
              ? "Carregando suas contas…"
              : state.status === "error"
                ? state.notice
                : "Nenhuma conta financeira disponível nesta residência."}
          </Text>
          {state.status !== "loading" ? (
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={state.retry}
            >
              <Text style={s.link}>Tentar novamente</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" style={s.button} onPress={back}>
            <Text style={s.link}>Voltar ao início</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  const data = state.data,
    currency = data.currencies.includes(chosen) ? chosen : data.currencies[0];
  const composition = balanceComposition(data, currency),
    account = composition.accounts.find((a) => a.id === accountId);
  const amount = (cents: number, code = currency) =>
    hidden ? "••••" : money(cents, code);
  const colors = ["#64826b", "#96975c", "#c6ac61", "#a7b891", "#8b9d82"];
  function select(code: string) {
    setCurrency(code);
    setAccount(null);
  }
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView ref={scroll} contentContainerStyle={s.content}>
        <Pressable accessibilityRole="button" style={s.back} onPress={back}>
          <MaterialCommunityIcons name="arrow-left" size={23} color={t.green} />
          <Text style={s.link}>Início</Text>
        </Pressable>
        <Text style={s.help}>
          {state.households.find((h) => h.id === state.householdId)?.name}
        </Text>
        <View style={s.header}>
          <View style={s.headerCopy}>
            <Text accessibilityRole="header" style={s.title}>
              {account ? account.name : "Composição do saldo"}
            </Text>
            <Text style={s.help}>
              {account
                ? "Detalhes da conta financeira."
                : "Veja quais contas formam seu saldo."}
            </Text>
          </View>
          <Image
            source={require("../../assets/pipo-balance-composition.webp")}
            style={s.art}
            resizeMode="contain"
            accessibilityLabel="Pipo conferindo um caderno ao lado de moedas"
          />
        </View>
        <Text style={s.help}>{periodLabel(state.period)}</Text>
        <View style={s.controls}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tabs}
          >
            {data.currencies.map((code) => (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityState={{ selected: code === currency }}
                style={[s.tab, code === currency && s.selected]}
                onPress={() => select(code)}
              >
                <Text style={[s.link, code === currency && s.white]}>
                  {code}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Mostrar valores" : "Ocultar valores"}
            accessibilityState={{ selected: hidden }}
            style={s.eye}
            onPress={() => setHidden(!hidden)}
          >
            <MaterialCommunityIcons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={t.green}
            />
          </Pressable>
        </View>
        {!composition.matched || !data.isReconciled ? (
          <Text accessibilityLiveRegion="assertive" style={s.warning}>
            Há uma divergência nos registros ou na composição. Atualize os dados
            e confira os lançamentos.
          </Text>
        ) : null}
        {account ? (
          <View style={s.panel}>
            <Pressable
              accessibilityRole="button"
              style={s.back}
              onPress={() => setAccount(null)}
            >
              <Text style={s.link}>‹ Voltar à composição</Text>
            </Pressable>
            <Text accessibilityRole="header" style={s.heading}>
              {account.name}
            </Text>
            <Text style={s.help}>
              {accountKindLabel(account.kind)} · {account.currency}
            </Text>
            {[
              {
                label: `Saldo até ${data.periodEnd.split("-").reverse().join("/")}`,
                value: account.balance,
              },
              { label: "Créditos no período", value: account.inflow },
              { label: "Débitos no período", value: account.outflow },
              { label: "Variação no período", value: account.change },
            ].map((item) => (
              <View key={item.label} style={s.row}>
                <Text style={s.help}>{item.label}</Text>
                <Text style={s.value}>{amount(item.value)}</Text>
              </View>
            ))}
            <Text style={s.help}>
              Créditos e débitos podem incluir transferências e ajustes; não
              equivalem às receitas e despesas da residência.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.panel}>
              <Text style={s.label}>Saldo em {currency}</Text>
              <Text style={s.total}>{amount(composition.total)}</Text>
              <Text style={s.help}>
                {composition.accounts.length} contas · Até{" "}
                {data.periodEnd.split("-").reverse().join("/")}
              </Text>
              {!hidden ? (
                <>
                  <View style={s.segments} accessible={false}>
                    {composition.accounts.map((a, index) => (
                      <View
                        key={a.id}
                        style={{
                          width: `${a.width}%`,
                          backgroundColor:
                            a.balance < 0
                              ? "#d96746"
                              : colors[index % colors.length],
                          height: 16,
                        }}
                      />
                    ))}
                  </View>
                  <Text style={s.caption}>
                    Barra em valores absolutos; negativos em laranja.
                    Percentuais sobre o saldo líquido.
                  </Text>
                  {composition.accounts.map((a, index) => (
                    <View key={a.id} style={s.legend}>
                      <View
                        style={[
                          s.dot,
                          {
                            backgroundColor:
                              a.balance < 0
                                ? "#d96746"
                                : colors[index % colors.length],
                          },
                        ]}
                      />
                      <Text style={s.legendName}>{a.name}</Text>
                      <Text
                        style={[s.legendAmount, a.balance < 0 && s.negative]}
                      >
                        {amount(a.balance)} (
                        {a.percent === null
                          ? "—"
                          : `${a.percent.toLocaleString("pt-BR")}%`}
                        )
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
            <View style={s.panel}>
              <Text accessibilityRole="header" style={s.heading}>
                Contas que compõem o saldo
              </Text>
              {composition.accounts.map((a) => (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver detalhes de ${a.name}`}
                  style={s.accountRow}
                  onPress={() => {
                    setAccount(a.id);
                    scroll.current?.scrollTo({ y: 0, animated: false });
                  }}
                >
                  <MaterialCommunityIcons
                    name="wallet-outline"
                    size={23}
                    color={t.green}
                  />
                  <View style={s.accountCopy}>
                    <Text style={s.label}>{a.name}</Text>
                    <Text style={s.caption}>{accountKindLabel(a.kind)}</Text>
                  </View>
                  <Text style={[s.value, a.balance < 0 && s.negative]}>
                    {amount(a.balance)}
                  </Text>
                  <Text style={s.link}>›</Text>
                </Pressable>
              ))}
              <View style={s.totalRow}>
                <Text style={s.label}>Total em {currency}</Text>
                <Text style={s.value}>{amount(composition.total)}</Text>
              </View>
            </View>
          </>
        )}
        <Text style={s.caption}>
          Valores em moedas diferentes são exibidos separadamente.
        </Text>
        {data.currencies
          .filter((code) => code !== currency)
          .map((code) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              style={s.other}
              onPress={() => select(code)}
            >
              <Text style={s.label}>Outra moeda · {code}</Text>
              <Text style={s.value}>
                {amount(
                  data.summaries.find((row) => row.currency === code)!.balance,
                  code,
                )}
              </Text>
              <Text style={s.link}>›</Text>
            </Pressable>
          ))}
        <Pressable
          accessibilityRole="button"
          style={s.button}
          onPress={state.retry}
        >
          <Text style={s.link}>Atualizar dados</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    padding: 16,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    paddingBottom: 28,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerCopy: { flex: 1 },
  title: {
    fontFamily: t.serif,
    fontSize: 27,
    lineHeight: 33,
    color: "#183d2b",
  },
  help: {
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: t.muted,
    marginVertical: 5,
  },
  art: { width: 120, height: 110 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 12,
  },
  tabs: { gap: 6 },
  tab: {
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#f0eadc",
  },
  selected: { backgroundColor: "#365d3e" },
  white: { color: "white" },
  eye: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    backgroundColor: "#fffcf4",
    padding: 14,
    marginBottom: 14,
  },
  label: { fontFamily: t.sans, fontSize: 12, color: "#183d2b" },
  total: { fontFamily: t.serif, fontSize: 31, color: "#183d2b", marginTop: 4 },
  segments: {
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 5,
    marginTop: 8,
    marginBottom: 8,
  },
  caption: {
    fontFamily: t.sans,
    fontSize: 10,
    lineHeight: 16,
    color: t.muted,
    marginTop: 4,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    flexWrap: "wrap",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { fontFamily: t.sans, fontSize: 10, color: "#183d2b", flex: 1 },
  legendAmount: { fontFamily: t.sans, fontSize: 10, color: "#183d2b" },
  negative: { color: "#b24429" },
  heading: {
    fontFamily: t.serif,
    fontSize: 19,
    color: "#183d2b",
    marginBottom: 10,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: t.line,
    minHeight: 60,
  },
  accountCopy: { flex: 1 },
  value: { fontFamily: t.sans, fontSize: 12, color: "#183d2b" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "#e6ead7",
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  link: { fontFamily: t.sans, fontSize: 12, color: "#365d3e" },
  other: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
    padding: 14,
    minHeight: 52,
    marginTop: 10,
  },
  button: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  warning: {
    padding: 14,
    backgroundColor: "#fbefcf",
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: "#805523",
    marginBottom: 12,
  },
});
