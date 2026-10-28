import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { money, type Home, type Household } from "@inout/finance";
import { theme as t } from "../theme";
import { NewRecordPicker } from "../components/NewRecordPicker";
export function DashboardSetupScreen({
  mode,
  data,
  households,
  householdId,
  period,
  currency,
  onCurrency,
  onHousehold,
  onRefresh,
}: {
  mode: "no-accounts" | "no-movements";
  data: Home;
  households: Household[];
  householdId: string;
  period: string;
  currency: string;
  onCurrency: (value: string) => void;
  onHousehold: (value: string) => void;
  onRefresh: () => void;
}) {
  const [picker, setPicker] = useState<"household" | "currency" | null>(null),
    [recordOpen, setRecordOpen] = useState(false);
  const none = mode === "no-accounts",
    codes = [...new Set(data.setupAccounts.map((a) => a.currency))],
    code = codes.includes(currency) ? currency : (codes[0] ?? "BRL"),
    context = { household: householdId, period, currency: code };
  const create = () =>
    router.push({ pathname: "/configuracao-inicial", params: context });
  const account = () =>
    none
      ? create()
      : router.push({ pathname: "/composicao-saldo", params: context });
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.brand}>Ninho 🍃</Text>
        <View style={s.top}>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={() => setPicker("household")}
          >
            <Text style={s.help}>
              ⌂ {households.find((h) => h.id === householdId)?.name} ▾
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.textButton}
            onPress={onRefresh}
          >
            <Text style={s.link}>Atualizar</Text>
          </Pressable>
        </View>
        {!data.isReconciled ? (
          <Text accessibilityLiveRegion="assertive" style={s.hint}>
            Há uma divergência na conciliação. Atualize os dados antes de usar
            seus saldos.
          </Text>
        ) : null}
        <Image
          source={
            none
              ? require("../../assets/pipo-empty-accounts.webp")
              : require("../../assets/pipo-first-movement.webp")
          }
          style={s.art}
          resizeMode="contain"
          accessibilityLabel={
            none
              ? "Pipo preparando um ninho ao lado de um caderno vazio"
              : "Pipo com um caderno ao lado de uma casinha"
          }
        />
        <Text accessibilityRole="header" style={s.title}>
          {none
            ? "Vamos preparar seu Ninho?"
            : "Seu Ninho está pronto para começar"}
        </Text>
        <Text style={s.subtitle}>
          {none
            ? "Crie uma conta financeira para organizar o dinheiro do seu lar."
            : "Você já tem uma conta. Agora registre sua primeira entrada ou saída."}
        </Text>
        {none ? (
          <>
            <Pressable
              accessibilityRole="button"
              style={s.primary}
              onPress={create}
            >
              <Text style={s.primaryText}>Criar conta financeira</Text>
            </Pressable>
            <Text style={s.caption}>
              Pode ser sua carteira, conta corrente ou poupança.
            </Text>
            <Text style={s.hint}>
              ⓘ Conta financeira é onde seu dinheiro fica.
            </Text>
          </>
        ) : (
          <>
            {codes.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                style={s.textButton}
                onPress={() => setPicker("currency")}
              >
                <Text style={s.link}>Moeda do novo registro: {code} ▾</Text>
              </Pressable>
            ) : null}
            {data.setupAccounts.map((a) => (
              <View key={a.id} style={s.account}>
                <MaterialCommunityIcons
                  name="wallet-outline"
                  size={24}
                  color="#315b3d"
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.accountName}>{a.name}</Text>
                  <Text style={s.help}>
                    {a.initialBalance === null
                      ? "Saldo atual"
                      : "Saldo inicial"}
                    : {money(a.initialBalance ?? a.balance, a.currency)}
                  </Text>
                </View>
              </View>
            ))}
            <View style={s.actions}>
              {(["income", "expense"] as const).map((kind) => (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  style={[s.primary, s.action, kind === "expense" && s.expense]}
                  onPress={() =>
                    router.push({
                      pathname: "/novo-registro",
                      params: { ...context, kind },
                    })
                  }
                >
                  <Text style={s.primaryText}>
                    Registrar {kind === "income" ? "entrada" : "saída"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.hint}>
              ⓘ O saldo inicial é o dinheiro que você já tinha.
            </Text>
            <Text accessibilityRole="header" style={s.heading}>
              Movimentações recentes
            </Text>
            <View style={s.empty}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={30}
                color="#83907d"
              />
              <Text style={s.accountName}>Nenhuma movimentação registrada</Text>
              <Text style={s.caption}>
                Registre sua primeira entrada ou saída para ver suas
                movimentações aqui.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      <View style={s.bottom}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          style={s.nav}
          onPress={onRefresh}
        >
          <MaterialCommunityIcons name="home" size={23} color="#315b3d" />
          <Text style={s.caption}>Início</Text>
        </Pressable>
        {!none ? (
          <Pressable
            accessibilityRole="button"
            style={s.nav}
            onPress={() => setRecordOpen(true)}
          >
            <MaterialCommunityIcons
              name="plus-circle"
              size={26}
              color="#315b3d"
            />
            <Text style={s.caption}>Registrar</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" style={s.nav} onPress={account}>
          <MaterialCommunityIcons
            name="wallet-outline"
            size={23}
            color="#315b3d"
          />
          <Text style={s.caption}>Contas</Text>
        </Pressable>
      </View>
      {recordOpen ? (
        <NewRecordPicker
          household={householdId}
          period={period}
          currency={code}
          onClose={() => setRecordOpen(false)}
        />
      ) : null}
      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={s.overlay}>
          <View style={s.modal} accessibilityViewIsModal>
            <Text style={s.heading}>
              {picker === "household" ? "Residência" : "Moeda"}
            </Text>
            <ScrollView>
              {(picker === "household"
                ? households
                : codes.map((c) => ({ id: c, name: c }))
              ).map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked:
                      picker === "household"
                        ? item.id === householdId
                        : item.id === code,
                  }}
                  style={s.textButton}
                  onPress={() => {
                    if (picker === "household") onHousehold(item.id);
                    else onCurrency(item.id);
                    setPicker(null);
                  }}
                >
                  <Text style={s.help}>{item.name}</Text>
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
    padding: 20,
    paddingBottom: 30,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  brand: { fontFamily: t.serif, fontSize: 24, color: "#15412b" },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  art: { width: "100%", height: 200, marginTop: 8 },
  title: {
    fontFamily: t.serif,
    fontSize: 28,
    lineHeight: 34,
    color: "#16442b",
    textAlign: "center",
    marginTop: 14,
  },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 14,
    lineHeight: 21,
    color: "#53614f",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 14,
  },
  help: { fontFamily: t.sans, fontSize: 13, color: "#4c594a", lineHeight: 20 },
  primary: {
    backgroundColor: "#075f3e",
    borderRadius: 10,
    minHeight: 48,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  primaryText: { fontFamily: t.sans, color: "white", fontSize: 14 },
  caption: {
    fontFamily: t.sans,
    fontSize: 11,
    color: "#757764",
    lineHeight: 17,
    textAlign: "center",
  },
  hint: {
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 19,
    color: "#697253",
    backgroundColor: "#f0ecd7",
    padding: 12,
    borderRadius: 9,
    marginVertical: 12,
  },
  account: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: "#fffdf5",
    borderWidth: 1,
    borderColor: "#e4ddc6",
    borderRadius: 12,
    padding: 14,
    marginVertical: 5,
  },
  accountName: { fontFamily: t.sans, fontSize: 14, color: "#243f2c" },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  expense: { backgroundColor: "#bf593c" },
  heading: {
    fontFamily: t.serif,
    fontSize: 18,
    color: "#24432e",
    marginVertical: 12,
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ded8c4",
    borderRadius: 12,
    padding: 22,
    gap: 8,
    alignItems: "center",
  },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderColor: "#e2dbc5",
    paddingVertical: 10,
  },
  nav: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  textButton: { minHeight: 44, justifyContent: "center" },
  link: { fontFamily: t.sans, fontSize: 13, color: "#315b3d" },
  overlay: {
    flex: 1,
    backgroundColor: "#20261c88",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: t.cream,
    borderRadius: 18,
    padding: 22,
    maxHeight: "80%",
  },
});
