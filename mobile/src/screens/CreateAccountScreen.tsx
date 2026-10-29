import { useState } from "react";
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
import { useFinancialHome } from "../finance/use-financial-home";
import { useAccount } from "../finance/use-account";
import { theme as t } from "../theme";
import {
  AccountKindPickerModal,
  ACCOUNT_KINDS,
} from "../components/account/AccountKindPickerModal";
import { AccountSuccessView } from "../components/account/AccountSuccessView";

export function CreateAccountScreen() {
  const p = useLocalSearchParams();
  const household = typeof p.household === "string" ? p.household : "";
  const period = typeof p.period === "string" ? p.period : "";
  const currency = typeof p.currency === "string" ? p.currency : "BRL";

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

  if (home.status !== "ready" || !home.data) {
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
  }

  const activeHousehold = home.households.find((h) => h.id === home.householdId);

  return (
    <AccountForm
      household={home.householdId}
      period={home.period}
      currency={currency}
      householdName={activeHousehold?.name ?? "Residência"}
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
  const state = useAccount(household, currency);
  const [pickerOpen, setPickerOpen] = useState(false);

  const back = () =>
    router.replace({
      pathname: "/inicio",
      params: { household, period, currency },
    });

  if (state.status === "loading" || state.status === "error") {
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
  }

  const { fields } = state;
  const locked = state.status !== "ready";
  const context = {
    household,
    period: fields.date.slice(0, 7),
    currency: fields.currency.trim().toUpperCase(),
  };

  const selectedKindLabel =
    ACCOUNT_KINDS.find(([id]) => id === fields.kind)?.[1] ?? "Selecionar tipo";

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
          <AccountSuccessView context={context} />
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
              onPress={() => setPickerOpen(true)}
            >
              <Text style={s.help}>{selectedKindLabel} ▾</Text>
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

      <AccountKindPickerModal
        visible={pickerOpen}
        selectedKind={fields.kind}
        onSelect={(kind) => {
          state.edit("kind", kind);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    padding: 24,
    gap: 12,
    alignItems: "stretch",
  },
  art: {
    width: "100%",
    height: 180,
    alignSelf: "center",
  },
  title: {
    fontFamily: t.serif,
    fontSize: 24,
    fontWeight: "700",
    color: t.ink,
    textAlign: "center",
  },
  help: {
    fontFamily: t.sans,
    fontSize: 14,
    color: t.muted,
    textAlign: "center",
  },
  label: {
    fontFamily: t.sans,
    fontSize: 14,
    fontWeight: "600",
    color: t.ink,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: t.ink,
  },
  button: {
    backgroundColor: t.green,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    fontFamily: t.sans,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  textButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  link: {
    fontFamily: t.sans,
    color: t.green,
    fontSize: 14,
  },
  notice: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: t.line,
    padding: 12,
    borderRadius: 8,
    color: t.ink,
  },
});
