import {
  AuxiliarySelector,
  DateSelector,
} from "../components/AuxiliarySelector";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { type RecordKind } from "@inout/finance";
import { useFinancialHome } from "../finance/use-financial-home";
import { useRecord } from "../finance/use-record";
import { theme as t } from "../theme";
const titles = {
  income: "Nova entrada",
  expense: "Nova saída",
  transfer: "Nova transferência",
};
export function NewRecordScreen() {
  const p = useLocalSearchParams(),
    kind = typeof p.kind === "string" ? p.kind : "",
    household = typeof p.household === "string" ? p.household : "",
    period = typeof p.period === "string" ? p.period : "",
    currency = typeof p.currency === "string" ? p.currency : "";
  if (!["income", "expense", "transfer"].includes(kind))
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>Tipo de movimentação inválido</Text>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() => router.replace("/inicio")}
          >
            <Text style={s.buttonText}>Voltar ao início</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <RecordView
      key={`${kind}:${household}:${period}:${currency}`}
      kind={kind as RecordKind}
      household={household}
      period={period}
      currency={currency}
    />
  );
}
function RecordView({
  kind,
  household,
  period,
  currency,
}: {
  kind: RecordKind;
  household: string;
  period: string;
  currency: string;
}) {
  const home = useFinancialHome({
    initialHouseholdId: household,
    initialPeriod: period,
  });
  if (home.status !== "ready" || !home.data)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>{titles[kind]}</Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {home.status === "loading"
              ? "Carregando residência…"
              : home.notice || "Nenhuma residência disponível."}
          </Text>
          {home.status !== "loading" ? (
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={home.retry}
            >
              <Text style={s.buttonText}>Tentar novamente</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => router.replace("/inicio")}
          >
            <Text style={s.link}>Voltar ao início</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <RecordForm
      household={home.householdId}
      period={home.period}
      currency={currency}
      kind={kind}
      householdName={
        home.households.find((row) => row.id === home.householdId)?.name ??
        "Residência"
      }
    />
  );
}
function RecordForm({
  household,
  period,
  currency,
  kind,
  householdName,
}: {
  household: string;
  period: string;
  currency: string;
  kind: RecordKind;
  householdName: string;
}) {
  const state = useRecord(household, kind, currency);
  const back = () =>
    router.replace({
      pathname: "/lancamentos",
      params: { household, period, currency },
    });
  if (state.status === "loading" || state.status === "error" || !state.options)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>{titles[kind]}</Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {state.status === "loading"
              ? "Carregando contas e categorias…"
              : state.notice}
          </Text>
          {state.status === "error" ? (
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={state.retry}
            >
              <Text style={s.buttonText}>Tentar novamente</Text>
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
  const options = state.options,
    fields = state.fields,
    locked = state.status !== "ready",
    account = options.accounts.find((row) => row.id === fields.accountId),
    categories = options.categories.filter((row) => row.flow === state.kind),
    destinations = options.accounts.filter(
      (row) =>
        row.id !== fields.accountId && row.currency === account?.currency,
    );
  const unavailable =
    !options.accounts.length ||
    (state.kind === "transfer" ? !destinations.length : !categories.length);
  const selectedCategory = categories.find((c) => c.id === fields.categoryId),
    parentId = selectedCategory?.parentId ?? fields.categoryId;
  const roots = categories.filter((c) => !c.parentId),
    children = categories.filter((c) => c.parentId === parentId);
  const creation = (
    target: "account" | "category" | "source",
    field: "accountId" | "destinationId" | "categoryId" | "sourceId",
    parent = "",
  ) => ({
    household,
    kind: target,
    flow: state.kind,
    parentId: parent,
    currency: account?.currency || currency || "BRL",
    fixedCurrency: field === "destinationId",
    onCreated: (id: string) => {
      state.edit(field, id);
      state.retry();
    },
  });
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          style={s.textButton}
          onPress={back}
        >
          <Text style={s.link}>‹ Lançamentos</Text>
        </Pressable>
        <Text style={s.caption}>{householdName}</Text>
        <View
          style={[
            s.hero,
            state.kind === "transfer" && {
              flexDirection: "column",
              alignItems: "stretch",
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={s.title}>
              {titles[state.kind]}
            </Text>
            <Text style={s.help}>
              {state.kind === "transfer"
                ? "Mova dinheiro entre as contas do seu lar."
                : state.kind === "income"
                  ? "Registre um dinheiro que entrou no seu lar."
                  : "Registre um gasto do seu lar."}
            </Text>
          </View>{" "}
          <Image
            source={
              state.kind === "income"
                ? require("../../assets/pipo-income-form.webp")
                : state.kind === "expense"
                  ? require("../../assets/pipo-expense-form.webp")
                  : require("../../assets/pipo-transfer-form.webp")
            }
            style={[
              s.heroArt,
              state.kind === "transfer" && { width: "100%", height: 140 },
            ]}
            resizeMode="contain"
            accessibilityLabel={
              state.kind === "income"
                ? "Pipo guardando uma moeda em uma bolsinha"
                : state.kind === "expense"
                  ? "Pipo conferindo as compras e o recibo"
                  : "Pipo levando uma moeda pela ponte entre duas contas"
            }
          />
        </View>
        {state.status === "success" ? (
          <View>
            <Text accessibilityLiveRegion="polite" style={s.help}>
              Registro salvo com sucesso.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={() =>
                router.replace({
                  pathname: "/inicio",
                  params: {
                    household,
                    period: fields.date.slice(0, 7),
                    currency: account?.currency ?? currency,
                  },
                })
              }
            >
              <Text style={s.buttonText}>Ver o período do lançamento</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {state.notice ? (
              <Text accessibilityLiveRegion="assertive" style={s.notice}>
                {state.notice}
              </Text>
            ) : null}
            {unavailable && !locked ? (
              <Text style={s.notice}>
                {!options.accounts.length
                  ? "Crie uma conta financeira antes de registrar."
                  : state.kind === "transfer"
                    ? "Uma transferência precisa de duas contas diferentes na mesma moeda."
                    : "Cadastre uma categoria correspondente a este tipo de movimentação antes de registrar."}
              </Text>
            ) : null}
            <Text style={s.label}>
              {state.kind === "income"
                ? "Conta de destino *"
                : "Conta de origem *"}
            </Text>
            <AuxiliarySelector
              title={
                state.kind === "income"
                  ? "Selecionar conta de destino"
                  : "Selecionar conta de origem"
              }
              value={fields.accountId}
              items={options.accounts.map((a) => ({
                ...a,
                detail: a.currency,
              }))}
              disabled={locked}
              onChange={(id) => state.edit("accountId", id)}
              create={creation("account", "accountId")}
            />
            {state.kind === "transfer" && (
              <View>
                <Text
                  style={{
                    textAlign: "center",
                    color: "#b58b24",
                    fontSize: 26,
                  }}
                >
                  ↓
                </Text>
                <Text style={s.label}>Conta de destino *</Text>
                <AuxiliarySelector
                  title="Selecionar conta de destino"
                  value={fields.destinationId}
                  items={options.accounts.map((a) => ({
                    ...a,
                    detail: `${a.currency}${a.id === account?.id ? " · Mesma conta de origem" : a.currency !== account?.currency ? " · Moeda incompatível" : ""}`,
                    disabled:
                      a.id === account?.id || a.currency !== account?.currency,
                  }))}
                  disabled={locked || !account}
                  onChange={(id) => state.edit("destinationId", id)}
                  create={creation("account", "destinationId")}
                />
                {account && (
                  <View style={s.unavailable}>
                    <Text style={s.label}>Contas indisponíveis</Text>
                    {options.accounts
                      .filter(
                        (a) =>
                          a.id === account.id ||
                          a.currency !== account.currency,
                      )
                      .map((a) => (
                        <Text key={a.id} style={s.caption}>
                          {a.name} · {a.currency} —{" "}
                          {a.id === account.id
                            ? "Mesma conta de origem"
                            : "Moeda incompatível"}
                        </Text>
                      ))}
                  </View>
                )}
              </View>
            )}
            {
              <View>
                <Text style={s.label}>Moeda da conta</Text>
                <View style={[s.input, { backgroundColor: "#efeee8" }]}>
                  <Text>{account?.currency ?? "Selecione uma conta"} 🔒</Text>
                </View>
                <Text style={s.caption}>
                  A moeda é definida pela conta escolhida.
                </Text>
              </View>
            }
            <Text style={s.label}>
              Valor * {account ? `(${account.currency})` : ""}
            </Text>
            <TextInput
              accessibilityLabel="Valor"
              editable={!locked}
              keyboardType="decimal-pad"
              style={[
                s.input,
                state.kind === "expense" && {
                  borderLeftWidth: 4,
                  borderLeftColor: "#bc4938",
                },
              ]}
              value={fields.amount}
              onChangeText={(value) => state.edit("amount", value)}
              placeholder="1250,50"
            />
            <Text style={s.caption}>
              Use vírgula ou ponto para os centavos, sem separador de milhar.
            </Text>
            {state.kind !== "transfer" && (
              <>
                <Text style={s.label}>Categoria *</Text>
                <AuxiliarySelector
                  title="Selecionar categoria"
                  value={
                    state.kind === "expense" ? parentId : fields.categoryId
                  }
                  items={state.kind === "expense" ? roots : categories}
                  disabled={locked}
                  onChange={(id) => state.edit("categoryId", id)}
                  create={creation("category", "categoryId")}
                />
              </>
            )}
            {state.kind === "income" && (
              <>
                <Text style={s.label}>Fonte de renda (opcional)</Text>
                <AuxiliarySelector
                  title="Selecionar fonte de renda"
                  value={fields.sourceId}
                  items={[{ id: "", name: "Sem fonte" }, ...options.sources]}
                  disabled={locked}
                  onChange={(id) => state.edit("sourceId", id)}
                  create={creation("source", "sourceId")}
                />
              </>
            )}
            {state.kind === "expense" && (
              <View>
                <Text style={s.label}>Subcategoria (opcional)</Text>
                <AuxiliarySelector
                  title="Selecionar subcategoria"
                  value={selectedCategory?.parentId ? fields.categoryId : ""}
                  items={[
                    { id: "", name: "Usar a categoria selecionada" },
                    ...children,
                  ]}
                  context={`Categoria: ${categories.find((c) => c.id === parentId)?.name ?? ""}`}
                  disabled={locked || !parentId}
                  onChange={(id) => state.edit("categoryId", id || parentId)}
                  create={creation("category", "categoryId", parentId)}
                />
              </View>
            )}
            <Text style={s.label}>Data *</Text>
            <DateSelector
              value={fields.date}
              disabled={locked}
              onChange={(value) => state.edit("date", value)}
            />
            <Text style={s.label}>Descrição (opcional)</Text>
            <TextInput
              accessibilityLabel="Descrição"
              editable={!locked}
              style={[s.input, s.description]}
              multiline
              maxLength={500}
              value={fields.description}
              onChangeText={(value) => state.edit("description", value)}
            />
            <Text style={[s.caption, { textAlign: "right" }]}>
              {fields.description.length}/500
            </Text>
            {state.kind === "transfer" && (
              <View style={s.transferNotice}>
                <Text style={s.help}>
                  ⓘ Transferências não contam como receita ou despesa.
                </Text>
                <Text style={s.caption}>
                  Escolha contas diferentes e com a mesma moeda.
                </Text>
              </View>
            )}
            <Text style={s.caption}>* Campos obrigatórios</Text>
            <Pressable
              accessibilityRole="button"
              disabled={state.status === "saving"}
              style={s.cancel}
              onPress={back}
            >
              <Text style={s.link}>
                {state.status === "uncertain"
                  ? "Voltar aos lançamentos"
                  : "Cancelar"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled:
                  state.status === "saving" ||
                  (state.status === "ready" && unavailable),
                busy: state.status === "saving",
              }}
              disabled={
                state.status === "saving" ||
                (state.status === "ready" && unavailable)
              }
              style={[
                s.button,
                state.kind === "expense" && { backgroundColor: "#bc4938" },
              ]}
              onPress={() => void state.submit()}
            >
              <Text style={s.buttonText}>
                {state.status === "saving"
                  ? "Salvando…"
                  : state.status === "uncertain"
                    ? "Verificar tentativa pendente"
                    : state.kind === "income"
                      ? "Registrar entrada"
                      : state.kind === "expense"
                        ? "Registrar saída"
                        : "Registrar transferência"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  unavailable: {
    padding: 12,
    backgroundColor: "#efeee7",
    borderRadius: 10,
    marginTop: 8,
    gap: 7,
  },
  transferNotice: {
    padding: 14,
    backgroundColor: "#f5efd3",
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
  },
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    padding: 22,
    paddingBottom: 40,
    gap: 8,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontFamily: t.serif,
    fontSize: 28,
    color: "#173e2b",
    marginBottom: 8,
  },
  hero: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroArt: { width: 130, height: 130 },
  help: { fontFamily: t.sans, fontSize: 14, color: "#4c5749", lineHeight: 21 },
  label: {
    fontFamily: t.sans,
    fontSize: 14,
    color: "#1d4530",
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#dfd7c4",
    borderRadius: 10,
    padding: 12,
    fontFamily: t.sans,
    fontSize: 15,
    color: "#203c2a",
    backgroundColor: "#fffdf8",
  },
  description: { height: 90, textAlignVertical: "top" },
  caption: { fontFamily: t.sans, fontSize: 11, color: t.muted },
  notice: {
    fontFamily: t.sans,
    fontSize: 14,
    color: "#9b4229",
    lineHeight: 21,
    marginVertical: 10,
  },
  button: {
    minHeight: 48,
    backgroundColor: "#315f3b",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  buttonText: { fontFamily: t.sans, fontSize: 15, color: "white" },
  cancel: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#56806a",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  textButton: { minHeight: 44, justifyContent: "center" },
  link: { fontFamily: t.sans, fontSize: 14, color: "#315f3b" },
  overlay: {
    flex: 1,
    backgroundColor: "#20261c88",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: t.cream,
    borderRadius: 18,
    padding: 18,
    maxHeight: "80%",
  },
  option: {
    minHeight: 48,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#e8dfcc",
    justifyContent: "center",
  },
});
