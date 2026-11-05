import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { money, accountKindLabel } from "@inout/finance";
import { groupAccounts, type ManagedAccount } from "@inout/finance/accounts";
import { useAccounts } from "../finance/use-accounts";
import { useFinancialHome } from "../finance/use-financial-home";
import { theme as t } from "../theme";
const kinds = [
  ["checking", "Conta corrente"],
  ["cash", "Carteira"],
  ["savings", "Poupança"],
  ["investment", "Investimento"],
  ["other", "Outro"],
];
export function AccountsScreen() {
  const p = useLocalSearchParams();
  const home = useFinancialHome({
    initialHouseholdId: typeof p.household === "string" ? p.household : "",
    initialPeriod: typeof p.period === "string" ? p.period : "",
  });
  if (home.status !== "ready")
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>Minhas contas</Text>
          <Text>
            {home.status === "loading"
              ? "Carregando residência…"
              : home.notice ||
                "Escolha uma residência para consultar as contas."}
          </Text>
          <Pressable accessibilityRole="button" onPress={home.retry}>
            <Text>Atualizar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/comecar")}
          >
            <Text>Escolher residência</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <AccountsView
      key={home.householdId}
      household={home.householdId}
      period={home.period}
      homeName={
        home.households.find((h) => h.id === home.householdId)?.name ??
        "Seu Ninho"
      }
    />
  );
}
function AccountsView({
  household,
  period,
  homeName,
}: {
  household: string;
  period: string;
  homeName: string;
}) {
  const state = useAccounts(household);
  const [archived, setArchived] = useState(false),
    [search, setSearch] = useState(""),
    [hidden, setHidden] = useState(false),
    [editing, setEditing] = useState<ManagedAccount | null>(null),
    [archiving, setArchiving] = useState<ManagedAccount | null>(null),
    [name, setName] = useState(""),
    [kind, setKind] = useState("checking");
  const groups = groupAccounts(state.accounts, { archived, search });
  function go(
    pathname:
      | "/residencia"
      | "/categorias"
      | "/gerenciar-fontes"
      | "/inicio"
      | "/lancamentos"
      | "/configuracao-inicial"
      | "/novo-registro"
      | "/composicao-saldo",
    extra: Record<string, string> = {},
  ) {
    router.push({ pathname, params: { household, period, ...extra } });
  }
  const action = (
    label: string,
    onPress: () => void,
    primary = false,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={[s.button, primary && s.primary, disabled && s.disabled]}
      onPress={onPress}
    >
      <Text style={primary ? s.primaryText : s.buttonText}>{label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        {action(`‹ ${homeName}`, () => go("/inicio"))}
        <View style={s.hero}>
          <View style={s.copy}>
            <Text accessibilityRole="header" style={s.title}>
              Minhas contas
            </Text>
            <Text style={s.help}>Cada conta, um cantinho do seu dinheiro.</Text>
          </View>
          <Image
            source={
              archived
                ? require("../../assets/pipo-archive.png")
                : require("../../assets/pipo-accounts.png")
            }
            style={s.art}
          />
        </View>
        {action("＋ Nova conta", () => go("/configuracao-inicial"), true)}
        <View style={s.row}>
          {action(
            `Ativas (${state.accounts.filter((a) => !a.archivedAt).length})`,
            () => setArchived(false),
            !archived,
          )}
          {action(
            `Arquivadas (${state.accounts.filter((a) => a.archivedAt).length})`,
            () => setArchived(true),
            archived,
          )}
        </View>
        <TextInput
          accessibilityLabel="Buscar conta pelo nome"
          style={s.input}
          placeholder="Buscar conta pelo nome"
          value={search}
          onChangeText={setSearch}
        />
        <View style={s.row}>
          {action(hidden ? "Mostrar saldos" : "Ocultar saldos", () =>
            setHidden(!hidden),
          )}
          {action("Atualizar", state.reload, false, state.busy)}
        </View>
        {action("Minha residência", () => go("/residencia"))}
        {action("Gerenciar categorias", () => go("/categorias"))}
        {action("Gerenciar fontes de renda", () => go("/gerenciar-fontes"))}
        {state.notice ? (
          <Text accessibilityLiveRegion="polite" style={s.notice}>
            {state.notice}
          </Text>
        ) : null}
        {archived ? (
          <Text style={s.notice}>
            Contas arquivadas mantêm seu histórico e não ficam disponíveis para
            novos lançamentos.
          </Text>
        ) : null}
        {state.loading ? (
          <Text accessibilityLiveRegion="polite">Carregando suas contas…</Text>
        ) : state.error ? (
          <View style={s.card}>
            <Text accessibilityRole="alert">{state.error}</Text>
            {action("Tentar novamente", state.reload)}
          </View>
        ) : groups.length === 0 ? (
          <View style={s.card}>
            <Text style={s.heading}>
              {search
                ? "Nenhuma conta encontrada"
                : archived
                  ? "Nenhuma conta arquivada"
                  : "Vamos preparar seu Ninho?"}
            </Text>
            <Text style={s.help}>
              {search
                ? "Tente outro nome."
                : archived
                  ? "As contas arquivadas aparecerão aqui."
                  : "Crie sua primeira conta financeira."}
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.currency}>
              <View style={s.group}>
                <Text style={s.heading}>
                  {group.currency} · {group.accounts.length} contas
                </Text>
                <Text style={s.help}>Saldo das contas exibidas</Text>
                <Text style={s.amount}>
                  {hidden ? "••••" : money(group.balance, group.currency)}
                </Text>
              </View>
              {group.accounts.map((a) => (
                <View key={a.id} style={s.card}>
                  <Text style={s.heading}>▣ {a.name}</Text>
                  <Text style={s.help}>
                    {accountKindLabel(a.kind)} · {a.currency} ·{" "}
                    {a.archivedAt ? "Arquivada" : "Ativa"}
                  </Text>
                  <Text style={[s.amount, a.balance < 0 && s.negative]}>
                    {hidden ? "••••" : money(a.balance, a.currency)}
                  </Text>
                  {action(
                    a.archivedAt
                      ? "Consultar histórico preservado →"
                      : "Ver detalhes da conta →",
                    () =>
                      go(a.archivedAt ? "/lancamentos" : "/composicao-saldo", {
                        accountId: a.id,
                        currency: a.currency,
                      }),
                  )}
                  {action("Ver extrato →", () =>
                    go("/lancamentos", { accountId: a.id }),
                  )}
                  {!a.archivedAt ? (
                    <>
                      <View style={s.row}>
                        {[
                          ["income", "Entrada"],
                          ["expense", "Saída"],
                          ["transfer", "Transferência"],
                        ].map(([k, label]) => (
                          <View key={k}>
                            {action(label, () =>
                              go("/novo-registro", {
                                kind: k,
                                accountId: a.id,
                                currency: a.currency,
                              }),
                            )}
                          </View>
                        ))}
                      </View>
                      <View style={s.row}>
                        {action(
                          "Editar conta",
                          () => {
                            setEditing(a);
                            setName(a.name);
                            setKind(a.kind.toLowerCase());
                          },
                          false,
                          state.busy,
                        )}
                        {action(
                          "Arquivar",
                          () => setArchiving(a),
                          false,
                          state.busy,
                        )}
                      </View>
                    </>
                  ) : (
                    <Text style={s.help}>
                      Arquivada em{" "}
                      {new Date(a.archivedAt).toLocaleDateString("pt-BR")}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
        <Text style={s.help}>
          Saldos atuais calculados pelos lançamentos. Moedas diferentes são
          apresentadas separadamente.
        </Text>
        {action("Composição por período →", () => go("/composicao-saldo"))}
      </ScrollView>
      <Modal
        visible={Boolean(editing || archiving)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!state.busy) {
            setEditing(null);
            setArchiving(null);
          }
        }}
      >
        <View style={s.overlay}>
          <ScrollView contentContainerStyle={s.modal} accessibilityViewIsModal>
            <Image
              source={
                archiving
                  ? require("../../assets/pipo-archive.png")
                  : require("../../assets/pipo-accounts.png")
              }
              style={{ width: 200, height: 140, alignSelf: "center" }}
              resizeMode="contain"
              accessibilityLabel="Pipo cuidando do seu caderno de contas"
            />
            <Text style={s.title}>
              {editing ? "Editar conta" : `Arquivar ${archiving?.name}?`}
            </Text>
            {editing ? (
              <>
                <Text style={s.heading}>Nome</Text>
                <TextInput
                  accessibilityLabel="Nome da conta"
                  style={s.input}
                  value={name}
                  maxLength={80}
                  onChangeText={setName}
                />
                <Text style={s.heading}>Tipo</Text>
                {kinds.map(([id, label]) => (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: kind === id }}
                    style={s.button}
                    onPress={() => setKind(id)}
                  >
                    <Text>
                      {kind === id ? "✓ " : ""}
                      {label}
                    </Text>
                  </Pressable>
                ))}
                <Text style={s.help}>
                  A moeda e os lançamentos permanecem vinculados à conta.
                </Text>
                {action(
                  state.busy ? "Salvando…" : "Salvar alterações",
                  () => {
                    void state.edit(editing.id, name, kind).then((ok) => {
                      if (ok) setEditing(null);
                    });
                  },
                  true,
                  state.busy || !name.trim(),
                )}
              </>
            ) : (
              <>
                <Text style={s.help}>
                  A conta sairá da lista de ativas. Seu saldo e histórico serão
                  preservados, e ela não poderá receber novos lançamentos.
                </Text>
                {action(
                  state.busy ? "Arquivando…" : "Confirmar arquivamento",
                  () => {
                    if (archiving)
                      void state.archive(archiving.id).then((ok) => {
                        if (ok) setArchiving(null);
                      });
                  },
                  true,
                  state.busy,
                )}
              </>
            )}
            {state.notice ? (
              <Text accessibilityLiveRegion="polite">{state.notice}</Text>
            ) : null}
            {action(
              "Cancelar",
              () => {
                setEditing(null);
                setArchiving(null);
              },
              false,
              state.busy,
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: { padding: 22, gap: 16, paddingBottom: 40 },
  hero: { flexDirection: "row", alignItems: "center" },
  copy: { flex: 1 },
  art: { width: 145, height: 125, resizeMode: "contain" },
  title: {
    fontFamily: t.serif,
    fontSize: 30,
    color: "#244735",
    marginBottom: 10,
  },
  heading: { fontFamily: t.serif, fontSize: 20, color: "#244735" },
  help: { fontFamily: t.sans, color: t.muted, lineHeight: 22 },
  card: {
    backgroundColor: "#fffdf5",
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 22,
    padding: 20,
    gap: 12,
    marginBottom: 14,
  },
  group: { paddingVertical: 14, gap: 6 },
  amount: { fontFamily: t.serif, fontSize: 28, color: "#244735" },
  negative: { color: "#a3402e" },
  input: {
    backgroundColor: "#fffdf5",
    borderWidth: 1,
    borderColor: t.line,
    padding: 15,
    borderRadius: 12,
    color: t.ink,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    padding: 12,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    backgroundColor: "#f0efdf",
    justifyContent: "center",
  },
  primary: { backgroundColor: "#355d41" },
  primaryText: { color: "#fff", fontFamily: t.sans, textAlign: "center" },
  buttonText: { color: "#244735", fontFamily: t.sans },
  notice: {
    padding: 16,
    backgroundColor: "#f2ead1",
    borderRadius: 12,
    color: t.ink,
  },
  disabled: { opacity: 0.5 },
  overlay: {
    flex: 1,
    backgroundColor: "#14271f88",
    justifyContent: "center",
    padding: 20,
  },
  modal: { padding: 22, gap: 14, backgroundColor: t.cream, borderRadius: 22 },
});
