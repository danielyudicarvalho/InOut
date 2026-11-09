import { useState } from "react";
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
import { money, periodLabel, type FinancialAnalysis } from "@inout/finance";
import { useFinancialHome } from "../finance/use-financial-home";
import { useAnalysis } from "../finance/use-analysis";
import { PeriodPicker } from "../components/PeriodPicker";
import { theme as t } from "../theme";
export type AnalysisView =
  "hub" | "overview" | "compare" | "accounts" | "evolution" | "review";
const titles = {
  hub: "Análises",
  overview: "Visão geral do período",
  compare: "Comparar períodos",
  accounts: "Movimentação por conta",
  evolution: "Evolução financeira",
  review: "Revisão mensal",
};
const cards = [
  [
    "/analises/visao-geral",
    "Visão geral do período",
    "Receitas, despesas e resultado.",
  ],
  ["/analises/comparar", "Comparar períodos", "Entenda o que mudou."],
  [
    "/resumo-categorias",
    "Despesas por categoria",
    "Categorias e subcategorias.",
  ],
  ["/fontes-renda", "Receitas por fonte", "A distribuição das entradas."],
  [
    "/analises/contas",
    "Movimentação por conta",
    "Entradas, saídas e transferências.",
  ],
  ["/analises/evolucao", "Evolução financeira", "O caminho ao longo do tempo."],
  [
    "/analises/revisao-mensal",
    "Revisão mensal",
    "Mudanças relevantes e conferência.",
  ],
] as const;
export function AnalysisScreen({ view = "hub" }: { view?: AnalysisView }) {
  const p = useLocalSearchParams();
  const household = typeof p.household === "string" ? p.household : "";
  const period = typeof p.period === "string" ? p.period : "";
  const currency = typeof p.currency === "string" ? p.currency : "";
  return (
    <AnalysisContent
      key={`${household}:${period}:${currency}`}
      view={view}
      household={household}
      period={period}
      initialCurrency={currency}
    />
  );
}
function AnalysisContent({
  view,
  household,
  period,
  initialCurrency,
}: {
  view: AnalysisView;
  household: string;
  period: string;
  initialCurrency: string;
}) {
  const home = useFinancialHome({
    initialHouseholdId: household,
    initialPeriod: period,
  });
  const [chosen, setCurrency] = useState(initialCurrency);
  const [picker, setPicker] = useState(false);
  const currency = home.data?.currencies.includes(chosen)
    ? chosen
    : (home.data?.currencies[0] ?? "");
  const report = useAnalysis(
    home.status === "ready" ? home.householdId : "",
    home.period,
    currency,
  );
  const go = (path: string, filters: Record<string, string> = {}) =>
    router.push({
      pathname: path as "/analises",
      params: {
        household: home.householdId,
        period: home.period,
        currency,
        ...filters,
      },
    });
  const data = report.data;
  const changes =
    data?.changes
      .filter(
        (c) =>
          (c.kind === "category" || c.kind === "source") && c.deltaCents !== 0,
      )
      .sort((a, b) => Math.abs(b.deltaCents) - Math.abs(a.deltaCents))
      .slice(0, 10) ?? [];
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body}>
        <Action
          label={view === "hub" ? "← Início" : "← Todas as análises"}
          onPress={() => go(view === "hub" ? "/inicio" : "/analises")}
        />
        <Text style={s.eyebrow}>CUIDAR, ENTENDER, PLANEJAR</Text>
        <Text role="heading" style={s.title}>
          {titles[view]}
        </Text>
        <Text style={s.subtitle}>
          Um olhar tranquilo para as finanças da sua casa.
        </Text>
        <Image
          source={
            view === "compare" || view === "evolution"
              ? require("../../assets/pipo-analysis-growth.webp")
              : require("../../assets/pipo-analysis.webp")
          }
          style={s.art}
          resizeMode="contain"
          accessibilityLabel={
            view === "compare" || view === "evolution"
              ? "Pipo observa canteiros em diferentes estágios de crescimento"
              : "Pipo revisa o livro financeiro da casa"
          }
        />
        <View style={s.panel}>
          <Text style={s.label}>Residência</Text>
          <View style={s.chips}>
            {home.households.map((h) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: h.id === home.householdId }}
                key={h.id}
                style={[s.chip, h.id === home.householdId && s.selected]}
                onPress={() => home.selectHousehold(h.id)}
              >
                <Text style={s.ink}>{h.name}</Text>
              </Pressable>
            ))}
          </View>
          <Action
            label={
              home.period
                ? `${periodLabel(home.period)} ▾`
                : "Selecionar período"
            }
            onPress={() => setPicker(true)}
          />
          <View style={s.chips}>
            {home.data?.currencies.map((c) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: c === currency }}
                key={c}
                style={[s.chip, c === currency && s.selected]}
                onPress={() => setCurrency(c)}
              >
                <Text style={s.ink}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <Action
            label="Atualizar"
            onPress={() => {
              home.retry();
              report.retry();
            }}
          />
        </View>
        {picker && (
          <PeriodPicker
            value={home.period}
            onClose={() => setPicker(false)}
            onApply={(value) => {
              setPicker(false);
              home.selectPeriod(value);
            }}
          />
        )}
        {home.status === "error" ? (
          <Text accessibilityRole="alert" style={s.text}>
            {home.notice}
          </Text>
        ) : home.status === "empty" ||
          (home.status === "ready" && !currency) ? (
          <View style={s.panel}>
            <Text style={s.heading}>Seu primeiro olhar começa aqui</Text>
            <Text style={s.text}>
              Cadastre uma conta para acompanhar suas finanças.
            </Text>
            <Action label="Gerenciar contas →" onPress={() => go("/contas")} />
          </View>
        ) : report.notice ? (
          <View style={s.panel}>
            <Text accessibilityRole="alert" style={s.text}>
              {report.notice}
            </Text>
            <Action label="Tentar novamente" onPress={report.retry} />
          </View>
        ) : !data ? (
          <Text accessibilityLiveRegion="polite" style={s.text}>
            Preparando suas análises…
          </Text>
        ) : (
          <>
            {!data.isReconciled && (
              <Text accessibilityRole="alert" style={s.warning}>
                Há divergência na conciliação. Confira os registros antes de
                tirar conclusões.
              </Text>
            )}
            {(view === "hub" || view === "overview" || view === "review") && (
              <View style={s.stats}>
                {[
                  ["Receitas", data.current.incomeCents, "/receitas"],
                  ["Despesas", data.current.expenseCents, "/despesas"],
                  ["Resultado", data.current.resultCents, "/resultado"],
                ].map(([label, value, path]) => (
                  <Pressable
                    accessibilityRole="button"
                    key={label}
                    style={s.panel}
                    onPress={() => go(String(path))}
                  >
                    <Text style={s.label}>{label}</Text>
                    <Text style={s.amount}>
                      {money(Number(value), currency)}
                    </Text>
                    <Text style={s.link}>Conferir lançamentos →</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {view === "hub" &&
              cards.map(([path, title, description], i) => (
                <Pressable
                  accessibilityRole="button"
                  key={path}
                  style={s.card}
                  onPress={() => go(path)}
                >
                  <Text style={s.number}>
                    {String(i + 1).padStart(2, "0")} ↗
                  </Text>
                  <Text style={s.heading}>{title}</Text>
                  <Text style={s.text}>{description}</Text>
                </Pressable>
              ))}
            {view === "overview" && (
              <View style={s.panel}>
                <Text style={s.heading}>O retrato deste período</Text>
                <Text style={s.text}>
                  Resultado é a diferença entre receitas e despesas.
                  Transferências não alteram o resultado.
                </Text>
                <Text style={s.text}>
                  {data.current.resultCents >= 0
                    ? "As receitas cobriram as despesas neste período."
                    : "As despesas superaram as receitas neste período."}
                </Text>
                <Action
                  label="Conferir todos os lançamentos →"
                  onPress={() => go("/lancamentos")}
                />
                <Action
                  label="Despesas por categoria →"
                  onPress={() => go("/resumo-categorias")}
                />
                <Action
                  label="Receitas por fonte →"
                  onPress={() => go("/fontes-renda")}
                />
                <Action
                  label="Comparar períodos →"
                  onPress={() => go("/analises/comparar")}
                />
              </View>
            )}
            {(view === "compare" || view === "review") && (
              <Comparison data={data} />
            )}
            {view === "accounts" && (
              <>
                <Text style={s.text}>
                  Créditos e débitos incluem transferências, estornos e
                  eventuais saldos iniciais. Transferências não são receitas ou
                  despesas.
                </Text>
                {!data.accounts.length && (
                  <Text style={s.text}>Nenhuma conta nesta moeda.</Text>
                )}
                {data.accounts.map((a) => (
                  <View style={s.panel} key={a.id}>
                    <Text style={s.heading}>{a.name}</Text>
                    {[
                      ["Receitas líquidas", a.incomeCents],
                      ["Despesas líquidas", a.expenseCents],
                      ["Transferências recebidas", a.transferInCents],
                      ["Transferências enviadas", a.transferOutCents],
                      ["Créditos totais", a.inflowCents],
                      ["Débitos totais", a.outflowCents],
                      ["Variação da conta", a.changeCents],
                    ].map(([label, value]) => (
                      <Fact
                        key={label}
                        label={String(label)}
                        value={money(Number(value), currency)}
                      />
                    ))}
                    <Action
                      label="Conferir movimentações →"
                      onPress={() => go("/lancamentos", { accountId: a.id })}
                    />
                  </View>
                ))}
              </>
            )}
            {view === "evolution" && <Evolution data={data} />}
            {view === "review" && (
              <View style={s.panel}>
                <Text style={s.heading}>Mudanças que merecem um olhar</Text>
                <Text style={s.text}>
                  Comparação com o período anterior. Categorias e subcategorias
                  aparecem separadamente. Os dados não atribuem causas às
                  mudanças.
                </Text>
                {!changes.length && (
                  <Text style={s.text}>
                    Não há mudanças por categoria ou fonte neste período.
                  </Text>
                )}
                {changes.map((c) => (
                  <Pressable
                    accessibilityRole="button"
                    key={`${c.kind}:${c.id}`}
                    style={s.change}
                    onPress={() =>
                      go(
                        c.id ? "/lancamentos" : "/fontes-renda",
                        c.id
                          ? {
                              [c.kind === "category"
                                ? "categoryId"
                                : "incomeSourceId"]: c.id,
                            }
                          : {},
                      )
                    }
                  >
                    <Text style={s.label}>
                      {c.kind === "category"
                        ? "Categoria de despesa"
                        : "Fonte de renda"}
                    </Text>
                    <Text style={s.heading}>{c.name}</Text>
                    <Text style={s.text}>
                      {money(c.previousCents, currency)} →{" "}
                      {money(c.currentCents, currency)}
                    </Text>
                    <Text style={s.text}>
                      Diferença: {money(c.deltaCents, currency)} ·{" "}
                      {percentage(c.percentageChange)}
                    </Text>
                    <Text style={s.link}>Conferir registros →</Text>
                  </Pressable>
                ))}
                <Action
                  label="Conferir todos os registros →"
                  onPress={() => go("/lancamentos")}
                />
              </View>
            )}
            <Text style={s.footnote}>
              Valores líquidos de estornos. Contas arquivadas preservadas no
              histórico. Moedas analisadas separadamente.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
function percentage(v: number | null) {
  return v === null
    ? "sem base percentual"
    : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
function dateLabel(v: string) {
  return v.split("-").reverse().join("/");
}
function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.action}>
      <Text style={s.link}>{label}</Text>
    </Pressable>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fact}>
      <Text style={s.text}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}
function Comparison({ data }: { data: FinancialAnalysis }) {
  return (
    <View style={s.panel}>
      <Text style={s.heading}>O que mudou?</Text>
      <Text style={s.text}>
        Atual: {dateLabel(data.from)} a {dateLabel(data.to)}
      </Text>
      <Text style={s.text}>
        Anterior: {dateLabel(data.previousFrom)} a {dateLabel(data.previousTo)}
      </Text>
      {data.changes
        .filter((c) => ["income", "expense", "result"].includes(c.kind))
        .map((c) => (
          <View style={s.change} key={c.kind}>
            <Text style={s.heading}>{c.name}</Text>
            <Fact
              label="Anterior"
              value={money(c.previousCents, data.currency)}
            />
            <Fact label="Atual" value={money(c.currentCents, data.currency)} />
            <Fact
              label="Diferença"
              value={money(c.deltaCents, data.currency)}
            />
            <Fact label="Variação" value={percentage(c.percentageChange)} />
          </View>
        ))}
      <Text style={s.footnote}>
        Percentual sobre o valor absoluto anterior. Com base zero e mudança, o
        percentual não se aplica. Alta nas despesas não significa melhora.
      </Text>
    </View>
  );
}
function Evolution({ data }: { data: FinancialAnalysis }) {
  const max = Math.max(
    1,
    ...data.series.flatMap((p) => [
      Math.abs(p.incomeCents),
      Math.abs(p.expenseCents),
      Math.abs(p.resultCents),
    ]),
  );
  return (
    <View style={s.panel}>
      <Text style={s.heading}>Seu caminho ao longo do tempo</Text>
      <Text style={s.text}>
        Um mês selecionado mostra seis meses. Intervalos personalizados são
        agrupados por mês dentro do intervalo.
      </Text>
      <Text style={s.text}>
        Verde: receitas · Terracota: despesas · Ocre: resultado
      </Text>
      <ScrollView horizontal>
        <View style={s.chart}>
          {data.series.map((p) => (
            <View key={p.from} style={s.column}>
              <View style={s.bars}>
                {[p.incomeCents, p.expenseCents, p.resultCents].map((v, i) => (
                  <View
                    key={i}
                    accessibilityLabel={`${["Receitas", "Despesas", "Resultado"][i]}: ${money(v, data.currency)}`}
                    style={{
                      width: 14,
                      height: Math.max(2, (Math.abs(v) / max) * 120),
                      backgroundColor: ["#5e7e4d", "#ce7650", "#b2995b"][i],
                      borderWidth: v < 0 ? 2 : 0,
                      borderColor: t.ink,
                      borderStyle: "dashed",
                    }}
                  />
                ))}
              </View>
              <Text style={s.label}>
                {p.from.slice(5, 7)}/{p.from.slice(0, 4)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={s.footnote}>
        Bordas tracejadas indicam valores negativos. Valores com sinal abaixo.
      </Text>
      {data.series.map((p) => (
        <View style={s.change} key={p.from}>
          <Text style={s.heading}>
            {dateLabel(p.from)} a {dateLabel(p.to)}
          </Text>
          <Fact label="Receitas" value={money(p.incomeCents, data.currency)} />
          <Fact label="Despesas" value={money(p.expenseCents, data.currency)} />
          <Fact label="Resultado" value={money(p.resultCents, data.currency)} />
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  body: { padding: 22, gap: 16, paddingBottom: 50 },
  eyebrow: {
    fontFamily: t.sans,
    color: t.green,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 10,
  },
  title: { fontFamily: t.serif, color: t.ink, fontSize: 32 },
  subtitle: {
    fontFamily: t.sans,
    color: t.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  art: { width: "100%", height: 180 },
  panel: {
    backgroundColor: "#fffdf7",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.line,
    padding: 20,
    gap: 12,
  },
  card: {
    backgroundColor: "#fffdf7",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.line,
    padding: 24,
    gap: 12,
  },
  heading: { fontFamily: t.serif, color: t.ink, fontSize: 20 },
  text: {
    fontFamily: t.sans,
    color: t.muted,
    fontSize: 14,
    lineHeight: 22,
    flexShrink: 1,
  },
  label: { fontFamily: t.sans, color: t.muted, fontSize: 12 },
  ink: { fontFamily: t.sans, color: t.ink },
  amount: { fontFamily: t.serif, color: t.ink, fontSize: 28 },
  link: { fontFamily: t.sans, color: "#365e48", fontSize: 14 },
  action: { minHeight: 44, justifyContent: "center", paddingVertical: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { padding: 12, borderWidth: 1, borderColor: t.line, borderRadius: 12 },
  selected: { backgroundColor: "#e6ecd9", borderColor: t.green },
  stats: { gap: 12 },
  number: { color: t.green, fontSize: 13 },
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  value: { fontFamily: t.sans, color: t.ink, fontSize: 14 },
  change: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: t.line,
    gap: 10,
  },
  footnote: {
    fontFamily: t.sans,
    color: t.muted,
    fontSize: 12,
    lineHeight: 19,
  },
  warning: {
    backgroundColor: "#fff0d2",
    padding: 16,
    borderRadius: 12,
    color: t.ink,
  },
  chart: { flexDirection: "row", gap: 16, paddingVertical: 20 },
  column: { width: 66, gap: 10, alignItems: "center" },
  bars: { height: 125, flexDirection: "row", alignItems: "flex-end", gap: 4 },
});
