import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createFinanceRepository,
  financeMessage,
  parseMoneyInput,
  parsePeriod,
} from "@inout/finance";
import { getAuthClient } from "../auth/composition";

export type PlanningView =
  | "hub"
  | "budgets"
  | "goals"
  | "projects"
  | "recurring"
  | "agenda"
  | "forecasts";

const art = {
  hub: require("../../assets/pipo-budgets.webp"),
  budgets: require("../../assets/pipo-budgets.webp"),
  goals: require("../../assets/pipo-goals.webp"),
  projects: require("../../assets/pipo-projects.webp"),
  recurring: require("../../assets/pipo-recurring.webp"),
  agenda: require("../../assets/pipo-agenda.webp"),
  forecasts: require("../../assets/pipo-forecast.webp"),
};

const routes = [
  ["/planejamento/orcamentos", "Orçamentos", "budgets"],
  ["/planejamento/metas", "Metas", "goals"],
  ["/planejamento/projetos", "Projetos", "projects"],
  ["/planejamento/recorrencias", "Recorrências", "recurring"],
  ["/planejamento/agenda", "Agenda", "agenda"],
  ["/planejamento/previsoes", "Previsões", "forecasts"],
] as const;

function repository() {
  return createFinanceRepository({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    getToken: async () => {
      const { data } = await getAuthClient().auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}

export function PlanningScreen({ view }: { view: PlanningView }) {
  const params = useLocalSearchParams();
  const router = useRouter();
  const household =
    typeof params.household === "string" ? params.household : "";
  const period = typeof params.period === "string" ? params.period : "";
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<unknown[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("BRL");
  function go(path: string) {
    router.push({
      pathname: path as "/planejamento",
      params: { household, period },
    });
  }
  useEffect(() => {
    if (!household || !period || view === "hub") return;
    const bounds = parsePeriod(period);
    const repo = repository();
    const load =
      view === "budgets"
        ? repo.budgets(household, bounds.from, bounds.to)
        : view === "goals"
          ? repo.goals(household)
          : view === "projects"
            ? repo.projects(household)
            : view === "recurring"
              ? repo.recurringPlans(household)
              : view === "agenda"
                ? repo.agenda(household, bounds.from, bounds.to)
                : repo.forecasts(household);
    load
      .then((data) => setRows(data as unknown[]))
      .catch((error) => setNotice(financeMessage(error)));
  }, [household, period, view, revision]);
  async function create() {
    if (!household || !period) return;
    const bounds = parsePeriod(period);
    const key = crypto.randomUUID();
    const repo = repository();
    try {
      const cents = parseMoneyInput(amount);
      if (view === "budgets") {
        await repo.setBudget(
          household,
          {
            categoryId: name,
            periodStart: bounds.from,
            periodEnd: bounds.to,
            limitCents: cents,
            currency,
          },
          key,
        );
      } else if (view === "goals") {
        await repo.createGoal(
          household,
          { name, targetCents: cents, currency, targetDate: null },
          key,
        );
      } else if (view === "projects") {
        await repo.createProject(
          household,
          {
            name,
            currency,
            plannedCents: cents,
            startsOn: bounds.from,
            endsOn: bounds.to,
            notes: null,
            lines: [
              {
                id: crypto.randomUUID(),
                name,
                flow: "expense",
                amountCents: cents,
              },
            ],
          },
          key,
        );
      } else if (view === "forecasts") {
        await repo.createForecast(
          household,
          { accountId: name, asOf: bounds.from, months: 3 },
          key,
        );
      }
      setNotice("Salvo.");
      setAmount("");
      setRevision((value) => value + 1);
    } catch (error) {
      setNotice(financeMessage(error));
    }
  }
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Pressable
        onPress={() => go(view === "hub" ? "/inicio" : "/planejamento")}
      >
        <Text style={s.back}>{view === "hub" ? "Início" : "Planejamento"}</Text>
      </Pressable>
      <Image
        source={art[view]}
        style={s.art}
        accessibilityLabel="Pipo no planejamento da casa"
      />
      <Text style={s.notice}>{notice}</Text>
      {view === "hub" ? (
        routes.map(([path, title, key]) => (
          <Pressable key={path} style={s.card} onPress={() => go(path)}>
            <Image source={art[key]} style={s.thumb} />
            <Text style={s.title}>{title}</Text>
          </Pressable>
        ))
      ) : (
        <View style={s.list}>
          {rows.map((row) => {
            const entry = row as {
              id?: string;
              name?: string;
              categoryName?: string;
              planName?: string;
              asOf?: string;
              currency?: string | null;
              scheduledOn?: string;
              state?: string;
              planId?: string;
            };
            const label =
              entry.categoryName ??
              entry.name ??
              entry.planName ??
              entry.asOf ??
              entry.scheduledOn ??
              "Item";
            const id = entry.id ?? `${entry.planId}:${entry.scheduledOn}`;
            return (
              <View key={id} style={s.card}>
                <Text style={s.title}>{label}</Text>
                <Text style={s.muted}>
                  {entry.currency ?? entry.state ?? ""}
                </Text>
              </View>
            );
          })}
          {view !== "agenda" && view !== "recurring" ? (
            <View style={s.form}>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder={
                  view === "budgets"
                    ? "Categoria"
                    : view === "forecasts"
                      ? "Conta"
                      : "Nome"
                }
              />
              {view !== "forecasts" ? (
                <TextInput
                  style={s.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="150,00"
                  keyboardType="decimal-pad"
                />
              ) : null}
              <TextInput
                style={s.input}
                value={currency}
                onChangeText={(value) => setCurrency(value.toUpperCase())}
                placeholder="BRL"
                maxLength={3}
              />
              <Pressable style={s.button} onPress={create}>
                <Text style={s.buttonText}>Salvar</Text>
              </Pressable>
            </View>
          ) : null}
          {view === "agenda" ? (
            <Text style={s.muted}>
              Toque em uma data na web para registrar a realização com o plano
              completo. Aqui a lista mostra prevista, pendente ou realizada.
            </Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 20, gap: 12, backgroundColor: "#fbf6e8" },
  art: { width: "100%", height: 180, resizeMode: "contain" },
  thumb: { width: 72, height: 48, resizeMode: "contain" },
  card: { backgroundColor: "#fffaf1", borderRadius: 16, padding: 14, gap: 4 },
  title: { fontSize: 18, color: "#40271e" },
  muted: { color: "#756650" },
  back: { color: "#365e48" },
  notice: { color: "#756650" },
  list: { gap: 12 },
  form: { gap: 8 },
  input: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e9dec7",
  },
  button: {
    backgroundColor: "#365e48",
    borderRadius: 999,
    padding: 12,
    alignItems: "center",
  },
  buttonText: { color: "white" },
});
