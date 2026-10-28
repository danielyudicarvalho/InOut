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
import { money, periodLabel } from "@inout/finance";
import { theme as t } from "../theme";
import { useFinancialHome } from "../finance/use-financial-home";
import { useIncomeDetails } from "../finance/use-income-details";
import { PeriodPicker } from "../components/PeriodPicker";
export function IncomeSourcesScreen() {
  const p = useLocalSearchParams(),
    household = typeof p.household === "string" ? p.household : "",
    period = typeof p.period === "string" ? p.period : "",
    currency = typeof p.currency === "string" ? p.currency : "";
  return (
    <IncomeSourcesView
      key={`${household}:${period}:${currency}`}
      initialHouseholdId={household}
      initialPeriod={period}
      initialCurrency={currency}
    />
  );
}
function IncomeSourcesView({
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
            Resumo por fonte de renda
          </Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {state.status === "loading"
              ? "Carregando fontes de renda…"
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
              Resumo por fonte de renda
            </Text>
            <Text style={s.help}>Veja de onde vêm as receitas do seu lar.</Text>
          </View>
          <Image
            source={require("../../assets/pipo-income-sources.webp")}
            style={s.art}
            resizeMode="contain"
            accessibilityLabel="Pipo regando plantas com moedas"
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
        <IncomeSourcesResults
          key={`${state.householdId}:${state.period}:${currency}`}
          household={state.householdId}
          period={state.period}
          currency={currency}
          expectedTotal={
            data.summaries.find((row) => row.currency === currency)!.income
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
          { label: "Fontes", icon: "chart-bar" },
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

function IncomeSourcesResults({
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
  const state = useIncomeDetails(household, period, currency);
  const [open, setOpen] = useState<string | null | undefined>(undefined),
    [selectedId, setSelectedId] = useState<string | null>(null);
  if (state.status !== "ready" || !state.data)
    return (
      <View style={s.panel}>
        <Text accessibilityLiveRegion="polite" style={s.help}>
          {state.status === "loading"
            ? "Carregando fontes de renda…"
            : state.notice}
        </Text>
        {state.status === "error" ? (
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={state.retry}
          >
            <Text style={s.link}>Tentar novamente</Text>
          </Pressable>
        ) : null}
      </View>
    );
  const data = state.data,
    sources = data.sources;
  const selected = data.items.find((row) => row.id === selectedId) ?? null;
  if (!sources)
    return (
      <Text style={s.help}>
        Atualize o backend para consultar os totais por fonte de renda.
      </Text>
    );
  const positive = data.total > 0 && sources.every((g) => g.amount >= 0),
    complete = data.items.length === data.totalCount;
  const colors = [
    "#075f3c",
    "#80b966",
    "#e7bc44",
    "#6a9a9a",
    "#a57ca1",
    "#d98b5f",
  ];
  return (
    <>
      {!data.isReconciled || data.total !== expectedTotal ? (
        <View style={s.warning}>
          <Text style={s.help}>
            Os dados mudaram ou há divergência na conciliação.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => {
              state.retry();
              refreshHome();
            }}
          >
            <Text style={s.link}>Atualizar</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={s.totalCard}>
        <Text style={s.help}>Receitas no período</Text>
        <Text style={s.total}>{money(data.total, currency)}</Text>
        <Text style={s.caption}>
          {data.totalCount}{" "}
          {data.totalCount === 1 ? "lançamento" : "lançamentos"} ·{" "}
          {sources.length} {sources.length === 1 ? "fonte" : "fontes"}
        </Text>
      </View>
      <View style={s.panel}>
        <Text style={s.heading}>Distribuição das receitas</Text>
        {positive ? (
          <View style={ss.bar}>
            {sources.map((g, i) => (
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
            {sources.length === 0
              ? "Nenhuma receita registrada neste período e moeda."
              : "A distribuição percentual não é exibida para total zero ou valores negativos."}
          </Text>
        )}
        {sources.map((g, i) => (
          <View style={ss.legend} key={g.id ?? "none"}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: colors[i % colors.length],
              }}
            />
            <View style={s.copy}>
              <Text style={s.rowTitle}>{g.name}</Text>
              <Text style={s.caption}>
                {g.count} {g.count === 1 ? "lançamento" : "lançamentos"}
              </Text>
            </View>
            <Text style={s.value}>
              {money(g.amount, currency)}
              {positive
                ? ` · ${((g.amount / data.total) * 100).toFixed(1)}%`
                : ""}
            </Text>
          </View>
        ))}
      </View>
      <Text accessibilityRole="header" style={s.heading}>
        Fontes de renda
      </Text>
      <Text style={s.help}>
        Selecione uma fonte para consultar seus lançamentos.
      </Text>
      {sources.map((g) => {
        const rows = data.items.filter((row) => row.sourceId === g.id);
        return (
          <View style={s.panel} key={g.id ?? "none"}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open === g.id }}
              style={s.row}
              onPress={() => setOpen(open === g.id ? undefined : g.id)}
            >
              <View style={s.copy}>
                <Text style={s.rowTitle}>{g.name}</Text>
                <Text style={s.caption}>
                  {g.count} {g.count === 1 ? "lançamento" : "lançamentos"}
                </Text>
              </View>
              <Text style={s.value}>{money(g.amount, currency)} ▾</Text>
            </Pressable>
            {open === g.id ? (
              <>
                {rows.map((row) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ver detalhes: ${row.description || "Receita"}`}
                    style={s.row}
                    key={row.id}
                    onPress={() => setSelectedId(row.id)}
                  >
                    <View style={s.copy}>
                      <Text style={s.rowTitle}>
                        {row.isReversal
                          ? "Estorno de receita"
                          : row.description || "Receita"}
                      </Text>
                      <Text style={s.caption}>
                        {row.date.split("-").reverse().join("/")}
                      </Text>
                    </View>
                    <Text style={[s.value, row.amount < 0 && s.negative]}>
                      {row.amount > 0 ? "+ " : ""}
                      {money(row.amount, currency)} ›
                    </Text>
                  </Pressable>
                ))}
                {rows.length < g.count ? (
                  <>
                    <Text style={s.caption}>
                      {rows.length} de {g.count} lançamentos desta fonte
                      carregados.
                    </Text>
                    {!complete ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={state.loadingMore}
                        accessibilityState={{ disabled: state.loadingMore }}
                        style={s.textButton}
                        onPress={state.loadMore}
                      >
                        <Text style={s.link}>
                          {state.loadingMore
                            ? "Carregando…"
                            : "Carregar mais lançamentos"}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={s.help}>
                        Há divergência na quantidade de lançamentos. Atualize a
                        lista.
                      </Text>
                    )}
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}
      {state.notice ? (
        <View>
          <Text accessibilityLiveRegion="assertive" style={s.help}>
            {state.notice}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={state.retry}
          >
            <Text style={s.link}>Atualizar lista</Text>
          </Pressable>
        </View>
      ) : null}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedId(null)}
      >
        <View style={s.backdrop}>
          <View style={s.modal} accessibilityViewIsModal>
            <ScrollView>
              <Text accessibilityRole="header" style={s.heading}>
                {selected?.isReversal
                  ? "Estorno de receita"
                  : selected?.description || "Receita"}
              </Text>
              {selected ? (
                <>
                  <Text style={s.help}>
                    Fonte: {selected.source || "Sem fonte de renda"}
                  </Text>
                  <Text style={s.help}>Conta: {selected.accountName}</Text>
                  <Text style={s.help}>
                    Data: {selected.date.split("-").reverse().join("/")}
                  </Text>
                  <Text style={s.help}>
                    Categoria: {selected.category || "Sem classificação"}
                  </Text>
                  <Text style={s.value}>
                    {money(selected.amount, currency)}
                  </Text>
                  {selected.isReversal ? (
                    <Text style={s.help}>
                      Este estorno reduz as receitas do período.
                    </Text>
                  ) : null}
                </>
              ) : null}
              <Pressable
                accessibilityRole="button"
                style={s.textButton}
                onPress={() => setSelectedId(null)}
              >
                <Text style={s.link}>Fechar detalhes</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
const ss = StyleSheet.create({
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
    marginVertical: 8,
  },
});
