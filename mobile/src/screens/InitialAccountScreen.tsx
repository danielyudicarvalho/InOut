import { useRef, useState, type ComponentRef } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../theme";
const currencies = [
  { code: "BRL", label: "Real brasileiro (BRL)" },
  { code: "USD", label: "Dólar americano (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
];
export function InitialAccountScreen({
  initialReady = false,
}: {
  initialReady?: boolean;
}) {
  const [name, setName] = useState("Minha conta principal");
  const [currency, setCurrency] = useState("BRL");
  const [balance, setBalance] = useState("0,00");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  });
  const [ready, setReady] = useState(initialReady);
  const [notice, setNotice] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  function updateName(value: string) {
    setName(value);
    setNotice("");
  }
  function updateBalance(value: string) {
    setBalance(value);
    setNotice("");
  }
  function updateDate(value: string) {
    setDate(value);
    setNotice("");
  }
  function submit() {
    if (!name.trim() || name.trim().length > 80) {
      setNotice("Informe um nome de 1 a 80 caracteres.");
      return;
    }
    if (!/^-?\d{1,12}(,\d{1,2})?$/.test(balance.trim())) {
      setNotice("Informe um saldo válido, como 1500,00 ou -100,50.");
      return;
    }
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    const parsed = match
      ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
      : null;
    if (
      !match ||
      !parsed ||
      parsed.getFullYear() !== Number(match[3]) ||
      parsed.getMonth() !== Number(match[2]) - 1 ||
      parsed.getDate() !== Number(match[1]) ||
      Number(match[3]) < 1900
    ) {
      setNotice("Informe uma data válida no formato DD/MM/AAAA.");
      return;
    }
    setNotice("");
    Keyboard.dismiss();
    setReady(true);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <View style={s.brand}>
              <MaterialCommunityIcons name="sprout" size={28} color={t.green} />
              <Text style={s.brandText}>ninho</Text>
            </View>
            <Text style={s.step}>Configuração inicial</Text>
          </View>
          <Image
            source={
              ready
                ? require("../../assets/pipo-first-account-success.webp")
                : require("../../assets/pipo-first-account-mobile.webp")
            }
            resizeMode="contain"
            style={s.art}
            accessibilityLabel={
              ready
                ? "Pipo comemorando com a carteira e um sinal de confirmação"
                : "Pipo ao lado de uma carteira verde e flores"
            }
          />
          <Text accessibilityRole="header" style={s.title}>
            {ready
              ? "Conta pronta. Vamos ao primeiro lançamento?"
              : "Vamos organizar seu primeiro cantinho."}
          </Text>
          <Text style={s.subtitle}>
            {ready
              ? "Registre uma entrada ou saída para começar a acompanhar suas finanças."
              : "Adicione sua primeira conta financeira para começar a acompanhar seu dinheiro de forma simples e tranquila."}
          </Text>
          {ready ? (
            <>
              <Pressable
                accessibilityRole="button"
                style={s.primary}
                onPress={() =>
                  setNotice(
                    "O formulário de entrada será implementado na próxima etapa.",
                  )
                }
              >
                <MaterialCommunityIcons
                  name="arrow-down-circle-outline"
                  size={26}
                  color="white"
                />
                <Text style={s.primaryText}>Registrar entrada</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.expense}
                onPress={() =>
                  setNotice(
                    "O formulário de saída será implementado na próxima etapa.",
                  )
                }
              >
                <MaterialCommunityIcons
                  name="arrow-up-circle-outline"
                  size={26}
                  color="#ad3a28"
                />
                <Text style={s.expenseText}>Registrar saída</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.linkTarget}
                onPress={() => router.replace("/inicio")}
              >
                <Text style={s.link}>Ir para o início</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.linkTarget}
                onPress={() => {
                  setReady(false);
                  setNotice("");
                }}
              >
                <Text style={s.link}>Revisar configuração</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.label}>Nome da conta</Text>
              <TextInput
                accessibilityLabel="Nome da conta"
                value={name}
                onChangeText={updateName}
                maxLength={80}
                style={s.input}
              />
              <Text style={s.label}>Moeda</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Moeda: ${currencies.find((item) => item.code === currency)?.label}`}
                accessibilityState={{ expanded: currencyOpen }}
                style={[s.input, s.currencySelect]}
                onPress={() => {
                  Keyboard.dismiss();
                  setCurrencyOpen(true);
                }}
              >
                <Text style={s.currencyText}>
                  {currencies.find((item) => item.code === currency)?.label}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={22}
                  color={t.ink}
                />
              </Pressable>
              <Text style={s.label}>Saldo inicial</Text>
              <TextInput
                accessibilityLabel="Saldo inicial na moeda selecionada"
                value={balance}
                onChangeText={updateBalance}
                maxLength={16}
                style={s.input}
                autoCorrect={false}
                placeholder="0,00"
              />
              <Text style={s.label}>Data do saldo inicial</Text>
              <TextInput
                accessibilityLabel="Data do saldo inicial, dia mês e ano"
                value={date}
                onChangeText={updateDate}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                keyboardType="numbers-and-punctuation"
                style={s.input}
              />
              <View style={s.info}>
                <MaterialCommunityIcons
                  name="information"
                  size={22}
                  color="#885408"
                />
                <Text style={s.infoText}>
                  Saldo inicial é o dinheiro que você já tinha nessa data. É seu
                  ponto de partida, não uma nova entrada.{"\n"}Sem saldo?
                  Mantenha 0,00.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={s.primary}
                onPress={submit}
              >
                <Text style={s.primaryText}>Criar conta financeira</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.linkTarget}
                onPress={() => router.replace("/inicio")}
              >
                <Text style={s.link}>Configurar depois</Text>
              </Pressable>
            </>
          )}
          <Text accessibilityLiveRegion="polite" style={s.notice}>
            {notice}
          </Text>
          <Text style={s.preview}>
            Prévia de interface. Nenhuma conta ou lançamento é salvo; o saldo
            inicial não gera uma receita.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={currencyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyOpen(false)}
      >
        <View style={s.backdrop}>
          <View style={s.modal} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={s.modalTitle}>
              Moeda
            </Text>
            <View accessibilityRole="radiogroup">
              {currencies.map((item) => (
                <Pressable
                  key={item.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: currency === item.code }}
                  style={s.currency}
                  onPress={() => {
                    setCurrency(item.code);
                    setCurrencyOpen(false);
                    setNotice("");
                  }}
                >
                  <Text style={s.currencyText}>{item.label}</Text>
                  <MaterialCommunityIcons
                    name={
                      currency === item.code
                        ? "radiobox-marked"
                        : "radiobox-blank"
                    }
                    size={22}
                    color={t.green}
                  />
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              style={s.linkTarget}
              onPress={() => setCurrencyOpen(false)}
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
    padding: 18,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  brand: { flexDirection: "row", alignItems: "center", gap: 5 },
  brandText: { fontFamily: t.serif, fontSize: 28, color: t.ink },
  step: { fontFamily: t.sans, fontSize: 11, color: t.muted, flexShrink: 1 },
  art: { width: "100%", aspectRatio: 2.5, marginTop: 12 },
  title: { fontFamily: t.serif, fontSize: 29, lineHeight: 34, color: t.ink },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 14,
    lineHeight: 21,
    color: t.ink,
    marginTop: 8,
    marginBottom: 8,
  },
  label: {
    fontFamily: t.sans,
    fontSize: 13,
    color: t.ink,
    marginTop: 16,
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: t.sans,
    fontSize: 15,
    color: t.ink,
    backgroundColor: "#fffcf4",
  },
  currencySelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#32291e99",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: t.cream,
    padding: 24,
    borderRadius: 18,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  modalTitle: {
    fontFamily: t.serif,
    fontSize: 24,
    color: t.ink,
    marginBottom: 12,
  },
  currency: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  currencyText: { fontFamily: t.sans, fontSize: 13, color: t.ink },
  info: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fbf1d6",
    padding: 13,
    borderRadius: 9,
    marginVertical: 18,
  },
  infoText: {
    flex: 1,
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: t.ink,
  },
  primary: {
    minHeight: 48,
    backgroundColor: "#00835c",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    padding: 10,
  },
  primaryText: { fontFamily: t.sans, fontSize: 15, color: "white" },
  expense: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#ad3a28",
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
    padding: 10,
  },
  expenseText: { fontFamily: t.sans, fontSize: 15, color: "#ad3a28" },
  linkTarget: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  link: {
    fontFamily: t.sans,
    fontSize: 13,
    color: "#35502a",
    textDecorationLine: "underline",
  },
  notice: {
    fontFamily: t.sans,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    marginTop: 12,
  },
  preview: {
    fontFamily: t.sans,
    fontSize: 10,
    lineHeight: 16,
    color: t.muted,
    textAlign: "center",
    marginTop: 12,
  },
});
