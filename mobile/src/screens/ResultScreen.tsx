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
import {
  money,
  periodLabel,
  recentResultEntries,
  type Summary,
} from "@inout/finance";
import { theme as t } from "../theme";
import { useFinancialHome } from "../finance/use-financial-home";
import { useExpenseDetails } from "../finance/use-expense-details";
import { useIncomeDetails } from "../finance/use-income-details";
import { PeriodPicker } from "../components/PeriodPicker";
export function ResultScreen() {
  const p = useLocalSearchParams(),
    household = typeof p.household === "string" ? p.household : "",
    period = typeof p.period === "string" ? p.period : "",
    currency = typeof p.currency === "string" ? p.currency : "";
  return (
    <ResultView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function ResultView({
  initialCurrency,
  ...options
}: {
  initialHouseholdId: string;
  initialPeriod: string;
  initialCurrency: string;
}) {
  const state = useFinancialHome(options),
    [chosen, setCurrency] = useState(initialCurrency),
    [periodOpen, setPeriodOpen] = useState(false),
    [picker, setPicker] = useState<"household" | "currency" | null>(null),
    [notice, setNotice] = useState("");
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
            Detalhamento do resultado
          </Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {state.status === "loading"
              ? "Carregando resultado…"
              : state.status === "error"
                ? state.notice
                : "Nenhuma conta financeira disponível nesta residência."}
          </Text>
          {state.status !== "loading" ? (
            <Pressable
              accessibilityRole="button"
              style={s.textButton}
              onPress={state.retry}
            >
              <Text style={s.link}>Atualizar</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={back}
          >
            <Text style={s.link}>Voltar ao início</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  const data = state.data,
    currency = data.currencies.includes(chosen) ? chosen : data.currencies[0];
  const household = state.households.find((h) => h.id === state.householdId)!;
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable
          accessibilityRole="button"
          style={s.top}
          onPress={() => setPicker("household")}
        >
          <MaterialCommunityIcons
            name="home-outline"
            size={20}
            color={t.green}
          />
          <Text style={s.link}>{household.name} ▾</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.textButton}
          onPress={back}
        >
          <Text style={s.link}>‹ Início</Text>
        </Pressable>
        <View style={s.hero}>
          <View style={s.heroCopy}>
            <Text accessibilityRole="header" style={s.title}>
              Detalhamento do resultado
            </Text>
            <Text style={s.help}>
              Entenda como suas receitas e despesas formam o resultado.
            </Text>
          </View>
          <Image
            source={require("../../assets/pipo-result.webp")}
            style={s.art}
            resizeMode="contain"
            accessibilityLabel="Pipo ao lado de uma balança e de um caderno"
          />
        </View>
        <View style={s.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Período: ${periodLabel(state.period)}`}
            style={s.control}
            onPress={() => setPeriodOpen(true)}
          >
            <MaterialCommunityIcons
              name="calendar-outline"
              size={18}
              color={t.green}
            />
            <Text style={s.link}>{periodLabel(state.period)} ▾</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Moeda: ${currency}`}
            style={s.control}
            onPress={() => setPicker("currency")}
          >
            <Text style={s.link}>{currency} ▾</Text>
          </Pressable>
        </View>
        <ResultDetails
          key={`${state.householdId}:${state.period}:${currency}`}
          household={state.householdId}
          period={state.period}
          currency={currency}
          summary={data.summaries.find((row) => row.currency === currency)!}
          reconciled={data.isReconciled}
          refreshHome={state.retry}
        />
        <Text accessibilityLiveRegion="polite" style={s.help}>
          {notice}
        </Text>
      </ScrollView>
      <View style={s.bottom}>
        {[
          { label: "Início", icon: "home-outline" },
          { label: "Resultado", icon: "chart-bar" },
          { label: "Contas", icon: "wallet-outline" },
          { label: "Mais", icon: "dots-horizontal" },
        ].map((item, index) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected: index === 1 }}
            style={s.nav}
            onPress={() => {
              if (index === 0) back();
              else if (index === 2)
                router.push({
                  pathname: "/composicao-saldo",
                  params: {
                    household: state.householdId,
                    period: state.period,
                    currency,
                  },
                });
              else if (index === 3)
                setNotice("Esta área ainda não está disponível.");
            }}
          >
            <MaterialCommunityIcons
              name={
                item.icon as
                  | "home-outline"
                  | "chart-bar"
                  | "wallet-outline"
                  | "dots-horizontal"
              }
              size={23}
              color={t.green}
            />
            <Text style={s.caption}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
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
              {picker === "currency" ? "Moeda" : "Residência"}
            </Text>
            <ScrollView>
              {(picker === "currency"
                ? data.currencies.map((code) => ({ id: code, name: code }))
                : state.households
              ).map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked:
                      picker === "currency"
                        ? currency === item.id
                        : state.householdId === item.id,
                  }}
                  style={s.option}
                  onPress={() => {
                    if (picker === "currency") setCurrency(item.id);
                    else state.selectHousehold(item.id);
                    setPicker(null);
                  }}
                >
                  <Text style={s.link}>{item.name}</Text>
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
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 24,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  textButton: { minHeight: 44, justifyContent: "center" },
  link: { fontFamily: t.sans, fontSize: 12, color: "#365d3e" },
  hero: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroCopy: { flex: 1 },
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
    marginVertical: 6,
  },
  art: { width: 130, height: 130 },
  controls: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginVertical: 12,
  },
  control: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fffcf4",
  },
  panel: { borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 14 },
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    backgroundColor: "#fffcf4",
    padding: 18,
  },
  total: {
    fontFamily: t.serif,
    fontSize: 29,
    lineHeight: 36,
    color: "#183d2b",
  },
  caption: { fontFamily: t.sans, fontSize: 10, lineHeight: 16, color: t.muted },
  heading: {
    fontFamily: t.serif,
    fontSize: 19,
    color: "#183d2b",
    marginTop: 18,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    padding: 12,
    marginVertical: 5,
    backgroundColor: "#fffcf4",
    minHeight: 65,
  },
  copy: { flex: 1 },
  rowTitle: { fontFamily: t.serif, fontSize: 13, color: "#183d2b" },
  value: { fontFamily: t.sans, fontSize: 12, color: "#27603a" },
  negative: { color: "#b24429" },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderColor: t.line,
    paddingVertical: 7,
    backgroundColor: "#fffcf4",
  },
  nav: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#29261e80",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: t.cream,
    padding: 22,
    borderRadius: 18,
    width: "100%",
    maxWidth: 480,
    maxHeight: "80%",
    alignSelf: "center",
  },
  option: {
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderColor: t.line,
    paddingVertical: 10,
  },
  warning: {
    backgroundColor: "#fbefcf",
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
  },
});

function ResultDetails({
  household,
  period,
  currency,
  summary,
  reconciled,
  refreshHome,
}: {
  household: string;
  period: string;
  currency: string;
  summary: Summary;
  reconciled: boolean;
  refreshHome: () => void;
}) {
  const income = useIncomeDetails(household, period, currency),
    expense = useExpenseDetails(household, period, currency);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const params = { household, period, currency };
  const open = (flow: "income" | "expense") =>
    router.push({
      pathname: flow === "income" ? "/receitas" : "/despesas",
      params,
    });
  const mismatch =
    !reconciled ||
    BigInt(summary.income) - BigInt(summary.expense) !==
      BigInt(summary.result) ||
    (income.data !== null &&
      (!income.data.isReconciled || income.data.total !== summary.income)) ||
    (expense.data !== null &&
      (!expense.data.isReconciled || expense.data.total !== summary.expense));
  const entries = recentResultEntries(
    income.data?.items ?? [],
    expense.data?.items ?? [],
    filter,
  );
  const busy = income.status === "loading" || expense.status === "loading",
    failed = income.status === "error" || expense.status === "error";
  return (
    <>
      <View style={s.totalCard}>
        <Text style={s.help}>Receitas</Text>
        <Text style={s.total}>{money(summary.income, currency)}</Text>
        <Pressable
          accessibilityRole="button"
          style={s.textButton}
          onPress={() => open("income")}
        >
          <Text style={s.link}>Ver receitas →</Text>
        </Pressable>
      </View>
      <Text style={rs.operator}>−</Text>
      <View style={[s.totalCard, rs.expense]}>
        <Text style={s.help}>Despesas</Text>
        <Text style={[s.total, s.negative]}>
          {money(summary.expense, currency)}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.textButton}
          onPress={() => open("expense")}
        >
          <Text style={s.link}>Ver despesas →</Text>
        </Pressable>
      </View>
      <Text style={rs.operator}>=</Text>
      <View style={s.totalCard}>
        <Text style={s.help}>Resultado do período</Text>
        <Text style={[s.total, summary.result < 0 && s.negative]}>
          {summary.result > 0 ? "+ " : ""}
          {money(summary.result, currency)}
        </Text>
        <Text style={s.caption}>Receitas menos despesas no período.</Text>
      </View>
      {mismatch ? (
        <View style={s.warning}>
          <Text accessibilityLiveRegion="assertive" style={s.help}>
            Os dados mudaram ou há divergência na conciliação.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => {
              refreshHome();
              income.retry();
              expense.retry();
            }}
          >
            <Text style={s.link}>Atualizar</Text>
          </Pressable>
        </View>
      ) : null}
      <Text accessibilityRole="header" style={s.heading}>
        Lançamentos recentes
      </Text>
      <Text style={s.caption}>
        Transferências entre contas não entram no resultado.
      </Text>
      <View style={rs.filters}>
        {(
          [
            ["all", "Todos"],
            ["income", "Receitas"],
            ["expense", "Despesas"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === value }}
            style={[rs.filter, filter === value && rs.filterActive]}
            onPress={() => setFilter(value)}
          >
            <Text style={filter === value ? rs.filterActiveText : s.link}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {busy ? (
        <Text accessibilityLiveRegion="polite" style={s.help}>
          Carregando lançamentos…
        </Text>
      ) : failed ? (
        <View>
          <Text accessibilityLiveRegion="assertive" style={s.help}>
            Não foi possível carregar os lançamentos.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => {
              income.retry();
              expense.retry();
            }}
          >
            <Text style={s.link}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <Text style={s.help}>Nenhum lançamento neste período e moeda.</Text>
      ) : (
        entries.map((row) => {
          const amount = row.flow === "income" ? row.amount : -row.amount;
          const title = row.isReversal
            ? `Estorno de ${row.flow === "income" ? "receita" : "despesa"}`
            : row.description ||
              (row.flow === "income" ? "Receita" : "Despesa");
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver lançamentos: ${title}`}
              key={`${row.flow}:${row.id}`}
              style={s.row}
              onPress={() => open(row.flow)}
            >
              <View style={s.copy}>
                <Text style={s.rowTitle}>{title}</Text>
                <Text style={s.caption}>
                  {row.date.split("-").reverse().join("/")} ·{" "}
                  {row.category || row.source || "Sem classificação"}
                </Text>
              </View>
              <Text style={[s.value, amount < 0 && s.negative]}>
                {amount > 0 ? "+ " : ""}
                {money(amount, currency)}
              </Text>
              <Text style={s.link}> ›</Text>
            </Pressable>
          );
        })
      )}
      <Pressable
        accessibilityRole="button"
        style={s.textButton}
        onPress={() => open("income")}
      >
        <Text style={s.link}>Todos os lançamentos de receita →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={s.textButton}
        onPress={() => open("expense")}
      >
        <Text style={s.link}>Todos os lançamentos de despesa →</Text>
      </Pressable>
    </>
  );
}
const rs = StyleSheet.create({
  operator: { textAlign: "center", fontSize: 22, color: "#183d2b" },
  expense: { backgroundColor: "#f9e9e2" },
  filters: { flexDirection: "row", gap: 8, marginVertical: 12 },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "#f5f0e5",
  },
  filterActive: { backgroundColor: "#284c31" },
  filterActiveText: { color: "white" },
});
