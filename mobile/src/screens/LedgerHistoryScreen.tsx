import { HistoryFiltersPanel } from "../components/HistoryFilters";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  money,
  displayDate,
  periodLabel,
  historyKind,
  type HistoryFilters,
} from "@inout/finance";
import { useFinancialHome } from "../finance/use-financial-home";
import { useLedgerHistory } from "../finance/use-ledger-history";
import { PeriodPicker } from "../components/PeriodPicker";
import { theme as t } from "../theme";
import { NewRecordPicker } from "../components/NewRecordPicker";
export function LedgerHistoryScreen() {
  const p = useLocalSearchParams();
  const home = useFinancialHome({
    initialHouseholdId: typeof p.household === "string" ? p.household : "",
    initialPeriod: typeof p.period === "string" ? p.period : "",
  });
  const [filters, setFilters] = useState<HistoryFilters>(() => ({
      transactionId: typeof p.transaction === "string" ? p.transaction : "",
    })),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [picker, setPicker] = useState(false),
    [filterOpen, setFilterOpen] = useState(false),
    [recordOpen, setRecordOpen] = useState(false);
  const change = (next: HistoryFilters) => {
    setFilters(next);
    setOffset(0);
  };
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.replace({
              pathname: "/inicio",
              params: { household: home.householdId, period: home.period },
            })
          }
        >
          <Text style={s.link}>
            ‹ Início ·{" "}
            {home.households.find((h) => h.id === home.householdId)?.name ??
              "Ninho"}
          </Text>
        </Pressable>
        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Histórico de lançamentos</Text>
            <Text>Acompanhe as movimentações do seu lar.</Text>
          </View>
          <Image
            source={require("../../assets/pipo-history.webp")}
            style={s.image}
          />
        </View>
        {filters.transactionId && (
          <Pressable style={s.button} onPress={() => change({})}>
            <Text>Ver histórico completo</Text>
          </Pressable>
        )}
        <TextInput
          style={s.input}
          accessibilityLabel="Buscar pela descrição"
          placeholder="Buscar lançamento…"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => change({ ...filters, search })}
        />
        <View style={s.tools}>
          <Pressable
            style={s.button}
            onPress={() => change({ ...filters, search })}
          >
            <Text>Buscar</Text>
          </Pressable>
          <Pressable style={s.button} onPress={() => setPicker(true)}>
            <Text>{periodLabel(home.period)}</Text>
          </Pressable>
          <Pressable
            style={s.button}
            onPress={() => setFilterOpen(!filterOpen)}
          >
            <Text>Filtros</Text>
          </Pressable>
        </View>
        <Pressable
          style={s.primary}
          disabled={!home.householdId}
          onPress={() => setRecordOpen(true)}
        >
          <Text style={{ color: "white" }}>+ Novo registro</Text>
        </Pressable>
        {home.status === "ready" ? (
          <HistoryRows
            key={`${home.householdId}:${home.period}:${JSON.stringify(filters)}:${offset}`}
            household={home.householdId}
            period={home.period}
            filters={filters}
            offset={offset}
            onPage={setOffset}
          />
        ) : (
          <Text accessibilityLiveRegion="polite">
            {home.status === "loading"
              ? "Carregando residências…"
              : home.notice || "Nenhuma residência disponível."}
          </Text>
        )}
        <Text style={s.help}>
          Transferências mostram uma movimentação por conta, na moeda de cada
          conta. Novos registros podem alterar as páginas.
        </Text>
      </ScrollView>
      {filterOpen && (
        <HistoryFiltersPanel
          key={home.householdId}
          household={home.householdId}
          period={home.period}
          filters={filters}
          onClose={() => setFilterOpen(false)}
          onApply={(period, next) => {
            home.selectPeriod(period);
            change(next);
            setSearch(next.search ?? "");
            setFilterOpen(false);
          }}
        />
      )}
      {recordOpen && (
        <NewRecordPicker
          household={home.householdId}
          period={home.period}
          currency={
            typeof p.currency === "string"
              ? p.currency
              : (home.data?.currencies[0] ?? "BRL")
          }
          onClose={() => setRecordOpen(false)}
        />
      )}
      {picker && (
        <PeriodPicker
          value={home.period}
          onClose={() => setPicker(false)}
          onApply={(value) => {
            home.selectPeriod(value);
            setOffset(0);
            setPicker(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}
function HistoryRows({
  household,
  period,
  filters,
  offset,
  onPage,
}: {
  household: string;
  period: string;
  filters: HistoryFilters;
  offset: number;
  onPage: (value: number) => void;
}) {
  const state = useLedgerHistory(household, period, filters, offset);
  if (state.loading)
    return (
      <Text accessibilityLiveRegion="polite">Carregando lançamentos…</Text>
    );
  if (state.error)
    return (
      <View>
        <Text accessibilityRole="alert">{state.error}</Text>
        <Pressable style={s.button} onPress={state.retry}>
          <Text>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  return (
    <View>
      {state.items.map((item, i) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Detalhes de ${item.description}`}
          key={`${item.transactionId}:${item.accountId}:${i}`}
          style={s.card}
          onPress={() =>
            router.push({
              pathname: "/lancamento",
              params: { household, period, transaction: item.transactionId },
            })
          }
        >
          <View style={s.tools}>
            <Text style={s.heading}>{item.description}</Text>
            <Text style={item.status === "reversed" ? s.reversed : s.posted}>
              {item.status === "reversed"
                ? "Estornado"
                : item.status === "posted"
                  ? "Registrado"
                  : item.status}
            </Text>
          </View>
          <Text>
            {historyKind(item)} · {displayDate(item.date)}
          </Text>
          <Text>{item.accountName}</Text>
          <Text>
            {item.category}
            {item.source ? ` · ${item.source}` : ""}
          </Text>
          <Text
            style={{
              fontWeight: "700",
              marginTop: 8,
              color:
                item.kind === "transfer"
                  ? "#966309"
                  : item.amount < 0
                    ? "#b42b24"
                    : "#14743d",
              textDecorationLine:
                item.status === "reversed" ? "line-through" : "none",
            }}
          >
            {money(item.amount, item.currency)} ›
          </Text>
        </Pressable>
      ))}
      {!state.items.length && (
        <Text>
          Nenhum lançamento encontrado neste período com estes filtros.
        </Text>
      )}
      <Text>
        {state.items.length} registros nesta página · Página {offset / 50 + 1}
      </Text>
      <View style={s.tools}>
        <Pressable
          style={s.button}
          disabled={!offset}
          onPress={() => onPage(Math.max(0, offset - 50))}
        >
          <Text style={{ opacity: offset ? 1 : 0.4 }}>Anterior</Text>
        </Pressable>
        <Pressable
          style={s.button}
          disabled={!state.hasMore}
          onPress={() => onPage(offset + 50)}
        >
          <Text style={{ opacity: state.hasMore ? 1 : 0.4 }}>Próxima</Text>
        </Pressable>
        <Pressable style={s.button} onPress={state.retry}>
          <Text>Atualizar</Text>
        </Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: { padding: 20, gap: 12 },
  title: { fontFamily: t.serif, fontSize: 27, color: "#214b36" },
  heading: {
    fontFamily: t.sans,
    fontWeight: "700",
    color: t.ink,
    flexShrink: 1,
  },
  link: { color: t.green, fontSize: 16 },
  hero: { flexDirection: "row", alignItems: "center", gap: 10 },
  image: { width: 120, height: 125, resizeMode: "contain" },
  input: {
    padding: 14,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    backgroundColor: "#fffdf6",
  },
  tools: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    padding: 12,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
    backgroundColor: "#fffdf6",
  },
  primary: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#245d3b",
    alignItems: "center",
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    backgroundColor: "#fffdf6",
    marginVertical: 6,
    gap: 8,
  },
  posted: {
    color: "#275836",
    backgroundColor: "#e0edd7",
    padding: 5,
    borderRadius: 8,
  },
  reversed: {
    color: "#aa2924",
    backgroundColor: "#ffe1d6",
    padding: 5,
    borderRadius: 8,
  },
  help: { fontSize: 12, color: t.muted },
  overlay: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "center",
    padding: 20,
  },
});
