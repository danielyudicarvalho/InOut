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
import { useFinancialHome } from "../finance/use-financial-home";
import { useAccount } from "../finance/use-account";
import { theme as t } from "../theme";
const kinds = [
  ["checking", "Conta corrente"],
  ["cash", "Carteira"],
  ["savings", "Poupança"],
  ["investment", "Investimento"],
  ["other", "Outro"],
];
export function CreateAccountScreen() {
  const p = useLocalSearchParams(),
    household = typeof p.household === "string" ? p.household : "",
    period = typeof p.period === "string" ? p.period : "",
    currency = typeof p.currency === "string" ? p.currency : "BRL";
  return (
    <AccountView
      key={`${household}:${period}:${currency}`}
      household={household}
      period={period}
      currency={currency}
    />
  );
}
function AccountView({
  household,
  period,
  currency,
}: {
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
          <Text style={s.title}>Criar conta financeira</Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {home.status === "loading"
              ? "Carregando residência…"
              : home.notice || "Escolha uma residência antes de criar a conta."}
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
            onPress={() => router.replace("/comecar")}
          >
            <Text style={s.link}>Escolher residência</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <AccountForm
      household={home.householdId}
      period={home.period}
      currency={currency}
      householdName={
        home.households.find((h) => h.id === home.householdId)?.name ??
        "Residência"
      }
    />
  );
}
function AccountForm({
  household,
  period,
  currency,
  householdName,
}: {
  household: string;
  period: string;
  currency: string;
  householdName: string;
}) {
  const state = useAccount(household, currency),
    [picker, setPicker] = useState(false);
  const back = () =>
    router.replace({
      pathname: "/inicio",
      params: { household, period, currency },
    });
  if (state.status === "loading" || state.status === "error")
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>Criar conta financeira</Text>
          <Text accessibilityLiveRegion="polite" style={s.help}>
            {state.status === "loading" ? "Carregando…" : state.notice}
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
  const fields = state.fields,
    locked = state.status !== "ready",
    context = {
      household,
      period: fields.date.slice(0, 7),
      currency: fields.currency.trim().toUpperCase(),
    };
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
          source={
            state.status === "success"
              ? require("../../assets/pipo-first-account-success.webp")
              : require("../../assets/pipo-empty-accounts.webp")
          }
          style={s.art}
          resizeMode="contain"
          accessibilityLabel={
            state.status === "success"
              ? "Pipo comemorando a conta criada"
              : "Pipo preparando seu ninho"
          }
        />
        <Text style={s.help}>{householdName}</Text>
        <Text accessibilityRole="header" style={s.title}>
          {state.status === "success"
            ? "Seu Ninho está pronto para começar"
            : "Criar conta financeira"}
        </Text>
        <Text style={s.help}>
          Conta financeira é onde seu dinheiro fica. Pode ser sua carteira,
          conta corrente ou poupança.
        </Text>
        {state.status === "success" ? (
          <>
            <Text accessibilityLiveRegion="polite" style={s.help}>
              Conta criada com sucesso.
            </Text>
            {(["income", "expense"] as const).map((kind) => (
              <Pressable
                accessibilityRole="button"
                style={s.button}
                key={kind}
                onPress={() =>
                  router.push({
                    pathname: "/novo-registro",
                    params: { ...context, kind },
                  })
                }
              >
                <Text style={s.buttonText}>
                  Registrar {kind === "income" ? "entrada" : "saída"}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              style={s.textButton}
              onPress={() =>
                router.replace({ pathname: "/inicio", params: context })
              }
            >
              <Text style={s.link}>Ir para o início</Text>
            </Pressable>
          </>
        ) : (
          <>
            {state.notice ? (
              <Text accessibilityLiveRegion="assertive" style={s.notice}>
                {state.notice}
              </Text>
            ) : null}
            <Text style={s.label}>Nome da conta</Text>
            <TextInput
              accessibilityLabel="Nome da conta"
              editable={!locked}
              style={s.input}
              maxLength={80}
              value={fields.name}
              onChangeText={(value) => state.edit("name", value)}
              placeholder="Minha conta principal"
            />
            <Text style={s.label}>Tipo</Text>
            <Pressable
              accessibilityRole="button"
              disabled={locked}
              style={s.input}
              onPress={() => setPicker(true)}
            >
              <Text style={s.help}>
                {kinds.find(([id]) => id === fields.kind)?.[1]} ▾
              </Text>
            </Pressable>
            <Text style={s.label}>Moeda (código de três letras)</Text>
            <TextInput
              accessibilityLabel="Moeda"
              editable={!locked}
              style={s.input}
              maxLength={3}
              value={fields.currency}
              autoCapitalize="characters"
              onChangeText={(value) =>
                state.edit("currency", value.toUpperCase())
              }
              placeholder="BRL"
            />
            <Text style={s.label}>Saldo inicial</Text>
            <TextInput
              accessibilityLabel="Saldo inicial"
              editable={!locked}
              style={s.input}
              value={fields.balance}
              onChangeText={(value) => state.edit("balance", value)}
              placeholder="0,00"
            />
            <Text style={s.help}>
              O saldo inicial é o dinheiro que você já tinha. Pode ser zero ou
              negativo.
            </Text>
            <Text style={s.label}>Data do saldo inicial (AAAA-MM-DD)</Text>
            <TextInput
              accessibilityLabel="Data do saldo inicial"
              editable={!locked}
              style={s.input}
              value={fields.date}
              maxLength={10}
              onChangeText={(value) => state.edit("date", value)}
            />
            <Pressable
              accessibilityRole="button"
              disabled={state.status === "saving"}
              accessibilityState={{
                disabled: state.status === "saving",
                busy: state.status === "saving",
              }}
              style={s.button}
              onPress={() => void state.submit()}
            >
              <Text style={s.buttonText}>
                {state.status === "saving"
                  ? "Salvando…"
                  : state.status === "uncertain"
                    ? "Verificar tentativa pendente"
                    : "Criar conta"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <Modal
        visible={picker}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(false)}
      >
        <View style={s.overlay}>
          <View style={s.modal} accessibilityViewIsModal>
            {kinds.map(([id, label]) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: fields.kind === id }}
                key={id}
                style={s.textButton}
                onPress={() => {
                  state.edit("kind", id);
                  setPicker(false);
                }}
              >
                <Text style={s.help}>{label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              style={s.textButton}
              onPress={() => setPicker(false)}
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
  art: { width: 270, height: 135, alignSelf: "center" },
  help: { fontFamily: t.sans, fontSize: 14, color: "#4c5749", lineHeight: 21 },
  label: { fontFamily: t.sans, fontSize: 14, color: "#1d4530", marginTop: 12 },
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
  notice: {
    fontFamily: t.sans,
    fontSize: 14,
    color: "#9b4229",
    lineHeight: 21,
  },
  button: {
    minHeight: 48,
    backgroundColor: "#315f3b",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
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
  modal: { backgroundColor: t.cream, borderRadius: 18, padding: 22 },
});
