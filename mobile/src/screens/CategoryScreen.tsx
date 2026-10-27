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
import { money, periodLabel, type CategoryGroup } from "@inout/finance";
import { theme as t } from "../theme";
import { useFinancialHome } from "../finance/use-financial-home";
import { useExpenseDetails } from "../finance/use-expense-details";
import { useCategorySummary } from "../finance/use-category-summary";
import { PeriodPicker } from "../components/PeriodPicker";
export function CategoryScreen() {
  const p = useLocalSearchParams(),
    household = typeof p.household === "string" ? p.household : "",
    period = typeof p.period === "string" ? p.period : "",
    currency = typeof p.currency === "string" ? p.currency : "";
  return (
    <CategoryView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function CategoryView({
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
            Resumo por categoria
          </Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {state.status === "loading"
              ? "Carregando categorias…"
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
              Resumo por categoria
            </Text>
            <Text style={s.help}>
              Descubra como suas despesas se distribuem.
            </Text>
          </View>
          <Image
            source={require("../../assets/pipo-category.webp")}
            style={s.art}
            resizeMode="contain"
            accessibilityLabel="Pipo organizando cestas de itens domésticos"
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
        <CategoryDetails
          key={`${state.householdId}:${state.period}:${currency}`}
          household={state.householdId}
          period={state.period}
          currency={currency}
          expectedTotal={
            data.summaries.find((row) => row.currency === currency)!.expense
          }
          refreshHome={state.retry}
        />
        <Text accessibilityLiveRegion="polite" style={s.help}>
          {notice}
        </Text>
      </ScrollView>
      <View style={s.bottom}>
        {[
          { label: "Início", icon: "home-outline" },
          { label: "Categorias", icon: "chart-bar" },
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

function CategoryDetails({
  household,
  period,
  currency,
  expectedTotal,
  refreshHome,
}: {
  household: string;
  period: string;
  currency: string;
  expectedTotal: number;
  refreshHome: () => void;
}) {
  const state = useCategorySummary(household, period, currency),
    expenses = useExpenseDetails(household, period, currency);
  const [selected, setSelected] = useState<CategoryGroup | undefined>(
      undefined,
    ),
    [open, setOpen] = useState<string | null>(null);
  if (state.loading)
    return (
      <Text accessibilityLiveRegion="polite" style={s.help}>
        Carregando categorias…
      </Text>
    );
  if (!state.data)
    return (
      <View>
        <Text accessibilityLiveRegion="assertive" style={s.help}>
          {state.error}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.textButton}
          onPress={state.retry}
        >
          <Text style={s.link}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  const data = state.data,
    mismatch =
      !data.isReconciled ||
      data.total !== expectedTotal ||
      (expenses.data !== null &&
        (!expenses.data.isReconciled || expenses.data.total !== data.total)),
    positive = data.total > 0 && data.groups.every((g) => g.amount >= 0);
  const colors = [
    "#365e48",
    "#ce7650",
    "#d49a39",
    "#779965",
    "#a77687",
    "#6d9292",
  ];
  const ids = new Set<string | null>();
  const visit = (g: CategoryGroup) => {
    ids.add(g.id);
    g.children.forEach(visit);
  };
  if (selected) visit(selected);
  const rows = selected
    ? (expenses.data?.items ?? []).filter((row) => ids.has(row.categoryId))
    : [];
  const complete =
    expenses.data && expenses.data.items.length === expenses.data.totalCount;
  return (
    <>
      {mismatch ? (
        <View style={s.warning}>
          <Text style={s.help}>
            Os dados mudaram ou há divergência na conciliação.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => {
              state.retry();
              expenses.retry();
              refreshHome();
            }}
          >
            <Text style={s.link}>Atualizar</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={s.totalCard}>
        <Text style={s.help}>Despesas no período</Text>
        <Text style={s.total}>{money(data.total, currency)}</Text>
        {positive ? (
          <View style={cs.bar}>
            {data.groups.map((g, i) => (
              <View
                key={g.id ?? "none"}
                style={{
                  flex: g.amount,
                  backgroundColor: colors[i % colors.length],
                }}
              />
            ))}
          </View>
        ) : (
          <Text style={s.caption}>
            {data.total === 0
              ? "Sem despesas líquidas no período."
              : "Gráfico indisponível para valores negativos."}
          </Text>
        )}
        {data.groups.map((g, i) => (
          <View key={g.id ?? "none"} style={cs.legend}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: colors[i % colors.length],
              }}
            />
            <Text style={s.copy}>{g.name}</Text>
            <Text>
              {money(g.amount, currency)}
              {positive
                ? ` · ${((g.amount / data.total) * 100).toFixed(1)}%`
                : ""}
            </Text>
          </View>
        ))}
      </View>
      <Text style={s.heading}>Categorias</Text>
      <Text style={s.help}>
        Selecione uma categoria ou subcategoria para ver os lançamentos.
      </Text>
      {data.groups.length === 0 ? (
        <Text style={s.help}>
          Nenhuma despesa líquida por categoria neste período e moeda.
        </Text>
      ) : (
        data.groups.map((g) => (
          <View key={g.id ?? "none"} style={s.panel}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open === (g.id ?? "none") }}
              style={s.row}
              onPress={() =>
                setOpen(open === (g.id ?? "none") ? null : (g.id ?? "none"))
              }
            >
              <Text style={s.copy}>{g.name}</Text>
              <Text>{money(g.amount, currency)} ▾</Text>
            </Pressable>
            {open === (g.id ?? "none") ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  style={s.textButton}
                  onPress={() => setSelected(g)}
                >
                  <Text style={s.link}>Ver lançamentos de {g.name} ›</Text>
                </Pressable>
                {g.children.map((child) => (
                  <Pressable
                    accessibilityRole="button"
                    style={s.row}
                    key={child.id}
                    onPress={() => setSelected(child)}
                  >
                    <Text style={s.copy}>{child.name}</Text>
                    <Text>{money(child.amount, currency)} ›</Text>
                  </Pressable>
                ))}
              </>
            ) : null}
          </View>
        ))
      )}
      {selected ? (
        <View style={s.panel}>
          <Text style={s.heading}>Lançamentos: {selected.name}</Text>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => setSelected(undefined)}
          >
            <Text style={s.link}>Fechar</Text>
          </Pressable>
          {expenses.status === "loading" ? (
            <Text style={s.help}>Carregando lançamentos…</Text>
          ) : expenses.status === "error" ? (
            <View>
              <Text style={s.help}>{expenses.notice}</Text>
              <Pressable
                accessibilityRole="button"
                style={s.textButton}
                onPress={expenses.retry}
              >
                <Text style={s.link}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {rows.length ? (
                rows.map((row) => (
                  <Text style={s.help} key={row.id}>
                    {row.isReversal
                      ? "Estorno de despesa"
                      : row.description || "Despesa"}{" "}
                    · {row.date.split("-").reverse().join("/")} ·{" "}
                    {money(-row.amount, currency)}
                  </Text>
                ))
              ) : (
                <Text style={s.help}>
                  {complete
                    ? "Nenhum lançamento nesta categoria."
                    : "Nenhum lançamento desta categoria nas páginas carregadas."}
                </Text>
              )}
              {expenses.notice ? (
                <View>
                  <Text style={s.help}>{expenses.notice}</Text>
                  <Pressable
                    accessibilityRole="button"
                    style={s.textButton}
                    onPress={expenses.retry}
                  >
                    <Text style={s.link}>Atualizar lista</Text>
                  </Pressable>
                </View>
              ) : null}
              {!complete ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: expenses.loadingMore }}
                  disabled={expenses.loadingMore}
                  style={s.textButton}
                  onPress={expenses.loadMore}
                >
                  <Text style={s.link}>
                    {expenses.loadingMore
                      ? "Carregando…"
                      : "Carregar mais lançamentos"}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </>
  );
}
const cs = StyleSheet.create({
  bar: {
    height: 18,
    flexDirection: "row",
    borderRadius: 9,
    overflow: "hidden",
    marginVertical: 16,
  },
  legend: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginVertical: 5,
  },
});
