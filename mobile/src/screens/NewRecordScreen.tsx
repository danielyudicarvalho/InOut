import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { type RecordFields, type RecordKind } from "@inout/finance";
import { useFinancialHome } from "../finance/use-financial-home";
import { useRecord } from "../finance/use-record";
import { theme as t } from "../theme";
const titles = {
  income: "Nova entrada",
  expense: "Nova saída",
  transfer: "Transferência",
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
  const state = useRecord(household, kind, currency),
    [picker, setPicker] = useState<keyof RecordFields | null>(null);
  const back = () =>
    router.replace({
      pathname: "/inicio",
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
  const choices =
    picker === "accountId"
      ? options.accounts.map((row) => ({
          id: row.id,
          name: `${row.name} · ${row.currency}`,
        }))
      : picker === "destinationId"
        ? destinations.map((row) => ({
            id: row.id,
            name: `${row.name} · ${row.currency}`,
          }))
        : picker === "categoryId"
          ? categories
          : [{ id: "", name: "Sem fonte de renda" }, ...options.sources];
  const label = (field: keyof RecordFields) =>
    field === "accountId"
      ? options.accounts.find((row) => row.id === fields.accountId)?.name
      : field === "destinationId"
        ? destinations.find((row) => row.id === fields.destinationId)?.name
        : field === "categoryId"
          ? categories.find((row) => row.id === fields.categoryId)?.name
          : (options.sources.find((row) => row.id === fields.sourceId)?.name ??
            "Sem fonte de renda");
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
          <Text style={s.link}>‹ Voltar ao início</Text>
        </Pressable>
        <Image
          source={require("../../assets/pipo-new-record.webp")}
          style={s.art}
          resizeMode="contain"
          accessibilityLabel="Pipo escrevendo em um caderno"
        />
        <Text style={s.help}>{householdName}</Text>
        <Text accessibilityRole="header" style={s.title}>
          {titles[state.kind]}
        </Text>
        <Text style={s.help}>
          {state.kind === "transfer"
            ? "Mova dinheiro entre suas contas. Transferências não contam como receita ou despesa."
            : "Informe os dados do lançamento."}
        </Text>
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
            {(
              [
                {
                  field: "accountId",
                  title:
                    state.kind === "transfer" ? "Conta de origem" : "Conta",
                },
                ...(state.kind === "transfer"
                  ? [{ field: "destinationId", title: "Conta de destino" }]
                  : [{ field: "categoryId", title: "Categoria" }]),
                ...(state.kind === "income"
                  ? [{ field: "sourceId", title: "Fonte de renda (opcional)" }]
                  : []),
              ] as { field: keyof RecordFields; title: string }[]
            ).map((item) => (
              <View key={item.field}>
                <Text style={s.label}>{item.title}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  disabled={locked}
                  accessibilityState={{ disabled: locked }}
                  style={s.input}
                  onPress={() => setPicker(item.field)}
                >
                  <Text style={s.help}>
                    {label(item.field) || "Selecione"} ▾
                  </Text>
                </Pressable>
              </View>
            ))}
            <Text style={s.label}>
              Valor {account ? `(${account.currency})` : ""}
            </Text>
            <TextInput
              accessibilityLabel="Valor"
              editable={!locked}
              keyboardType="decimal-pad"
              style={s.input}
              value={fields.amount}
              onChangeText={(value) => state.edit("amount", value)}
              placeholder="1250,50"
            />
            <Text style={s.caption}>
              Use vírgula ou ponto para os centavos, sem separador de milhar.
            </Text>
            <Text style={s.label}>Data (AAAA-MM-DD)</Text>
            <TextInput
              accessibilityLabel="Data no formato ano mês dia"
              editable={!locked}
              style={s.input}
              value={fields.date}
              onChangeText={(value) => state.edit("date", value)}
              placeholder="2026-10-28"
              autoCapitalize="none"
              maxLength={10}
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
              style={s.button}
              onPress={() => void state.submit()}
            >
              <Text style={s.buttonText}>
                {state.status === "saving"
                  ? "Salvando…"
                  : state.status === "uncertain"
                    ? "Verificar tentativa pendente"
                    : state.kind === "income"
                      ? "Salvar entrada"
                      : state.kind === "expense"
                        ? "Salvar saída"
                        : "Salvar transferência"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <Modal
        transparent
        visible={picker !== null}
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={s.overlay}>
          <View style={s.modal} accessibilityViewIsModal>
            <ScrollView>
              {choices.map((row) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: picker !== null && fields[picker] === row.id,
                  }}
                  key={row.id}
                  style={s.option}
                  onPress={() => {
                    if (picker) state.edit(picker, row.id);
                    setPicker(null);
                  }}
                >
                  <Text style={s.help}>{row.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              style={s.textButton}
              onPress={() => setPicker(null)}
            >
              <Text style={s.link}>Fechar seleção</Text>
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
  art: { width: 250, height: 120, alignSelf: "center" },
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
