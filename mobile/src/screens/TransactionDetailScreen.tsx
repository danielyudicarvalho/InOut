import { ClassificationSheet } from "../components/ClassificationSheet";
import { useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { canReverse, money, historyKind } from "@inout/finance";
import { useReversal } from "../finance/use-reversal";
import { ReversalDetail } from "../components/ReversalDetail";
import { ReversalSheet } from "../components/ReversalSheet";
import { theme as t } from "../theme";
export function TransactionDetailScreen() {
  const p = useLocalSearchParams();
  return (
    <DetailView
      key={`${p.household}:${p.transaction}`}
      household={typeof p.household === "string" ? p.household : ""}
      id={typeof p.transaction === "string" ? p.transaction : ""}
      period={typeof p.period === "string" ? p.period : ""}
      currency={typeof p.currency === "string" ? p.currency : ""}
    />
  );
}
function DetailView({
  household,
  id,
  period,
  currency,
}: {
  household: string;
  id: string;
  period: string;
  currency: string;
}) {
  const state = useReversal(household, id),
    [classify, setClassify] = useState(false),
    [corrected, setCorrected] = useState(false),
    [confirm, setConfirm] = useState(false),
    [dismissed, setDismissed] = useState(false);
  const back = () =>
      router.replace({
        pathname: "/lancamentos",
        params: {
          household,
          ...(period ? { period } : {}),
          currency: state.options?.currency ?? currency,
        },
      }),
    target = (transaction: string) =>
      router.push({
        pathname: "/lancamento",
        params: {
          household,
          transaction,
          ...(period ? { period } : {}),
          currency: state.options?.currency ?? currency,
        },
      });
  if (state.status === "loading" || state.status === "error" || !state.options)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.title}>Detalhe do lançamento</Text>
          <Text accessibilityLiveRegion="polite">
            {state.status === "loading"
              ? "Carregando lançamento…"
              : state.notice}
          </Text>
          {state.status !== "loading" && (
            <Pressable style={s.button} onPress={state.retry}>
              <Text>Tentar novamente</Text>
            </Pressable>
          )}
          <Pressable style={s.button} onPress={back}>
            <Text>Voltar ao histórico</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  const detail = state.options,
    done = state.status === "success",
    pending = state.status === "uncertain",
    saving = state.status === "saving",
    reversed = done || detail.status === "reversed",
    transfer = detail.kind === "transfer",
    opening = detail.kind === "openingbalance";
  const close = () => {
    if (!saving) {
      setConfirm(false);
      setDismissed(true);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable accessibilityRole="button" onPress={back} style={s.back}>
          <Text style={s.green}>‹ Lançamentos</Text>
        </Pressable>
        {detail.kind === "reversal" && detail.original ? (
          <ReversalDetail
            detail={detail}
            original={detail.original}
            onOriginal={() => target(detail.original!.id)}
            onBack={back}
          />
        ) : (
          <>
            <View style={s.hero}>
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={s.title}>
                  {transfer
                    ? "Detalhe da transferência"
                    : opening
                      ? "Detalhe do saldo inicial"
                      : "Detalhe do lançamento"}
                </Text>
                {!transfer && (
                  <Text style={s.help}>
                    {opening
                      ? "O ponto de partida da sua conta."
                      : "Confira abaixo todas as informações deste lançamento."}
                  </Text>
                )}
              </View>
              {!transfer && !opening && (
                <Image
                  source={require("../../assets/pipo-detail.webp")}
                  style={s.art}
                />
              )}
            </View>
            <View style={s.card}>
              <Text style={s.heading}>
                {opening ? "Saldo inicial da conta" : detail.description}
              </Text>
              <Text style={s.help}>
                {opening
                  ? "Posição inicial"
                  : historyKind({ kind: detail.kind })}
              </Text>
              <Text
                style={[
                  s.amount,
                  {
                    color: detail.amount < 0 ? "#b5432c" : "#2b6b42",
                    textDecorationLine: reversed ? "line-through" : "none",
                  },
                ]}
              >
                {money(detail.amount, detail.currency)}
              </Text>
              <Text
                style={[
                  s.status,
                  reversed && { backgroundColor: "#ffe0d2", color: "#a3422a" },
                ]}
              >
                {reversed ? "Estornado" : "Registrado"}
              </Text>
              {transfer && (
                <>
                  <Image
                    source={require("../../assets/pipo-transfer-detail.webp")}
                    style={s.transferArt}
                  />
                  <View
                    accessibilityLabel="Contas da transferência"
                    style={s.accounts}
                  >
                    {detail.postings.map((posting, i) => (
                      <View key={posting.accountId}>
                        {i === 1 && <Text style={s.arrow}>↓</Text>}
                        <View style={[s.account, i === 1 && s.destination]}>
                          <MaterialCommunityIcons
                            name={
                              i === 0
                                ? "wallet-outline"
                                : "account-group-outline"
                            }
                            size={28}
                            color="#315f3b"
                            accessible={false}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={s.label}>
                              {i === 0 ? "Origem" : "Destino"}
                            </Text>
                            <Text style={s.value}>{posting.accountName}</Text>
                            <Text style={s.help}>{posting.currency}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {opening && (
                <Image
                  source={require("../../assets/pipo-opening-detail.webp")}
                  style={s.openingArt}
                />
              )}
              {(transfer ? detail.rows.slice(2) : detail.rows).map((row, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.label}>
                    {transfer && row.label === "Data do lançamento"
                      ? "Data da transferência"
                      : opening && row.label === "Data do lançamento"
                        ? "Data de referência"
                        : opening && i === 0
                          ? "Conta"
                          : row.label}
                  </Text>
                  <Text style={s.value}>{row.value}</Text>
                </View>
              ))}
              {detail.postings.length > 1 && (
                <Text style={s.help}>
                  Esta transferência move dinheiro entre suas contas e não
                  altera o resultado do período.
                </Text>
              )}
              {detail.reversalOf && (
                <Pressable
                  style={s.button}
                  onPress={() => target(detail.reversalOf!)}
                >
                  <Text>Ver lançamento original deste estorno</Text>
                </Pressable>
              )}
            </View>
            {opening && (
              <View style={s.openingNotice}>
                <Text style={s.heading}>Saldo inicial não é receita</Text>
                <Text style={s.value}>
                  Representa o dinheiro que já existia na conta na data de
                  referência. Compõe o saldo, mas não entra nas receitas nem no
                  resultado do período.
                </Text>
                <Text style={s.help}>Não é um lançamento recorrente.</Text>
              </View>
            )}
            <View style={s.card}>
              <Text style={s.heading}>Registro</Text>
              <Text style={s.help}>
                Informações de auditoria deste lançamento.
              </Text>
              <Text style={s.label}>Registrado por (usuário)</Text>
              <Text selectable style={s.value}>
                {detail.createdBy}
              </Text>
              <Text style={s.label}>Registrado em</Text>
              <Text style={s.value}>
                {new Date(detail.postedAt).toLocaleString("pt-BR")}
              </Text>
              <Text style={s.help}>Horário do dispositivo</Text>
              <Text style={s.label}>Identificador</Text>
              <Text selectable style={s.value}>
                {detail.id}
              </Text>
            </View>
            {state.notice && (
              <Text accessibilityLiveRegion="polite" style={s.notice}>
                {done
                  ? "Estorno registrado com sucesso. O registro original foi mantido."
                  : state.notice}
              </Text>
            )}
            {done && state.result && (
              <Pressable
                style={s.button}
                onPress={() => target(state.result!.transactionId)}
              >
                <Text>Ver movimentação de estorno</Text>
              </Pressable>
            )}
            {opening && (
              <Pressable
                accessibilityRole="button"
                style={[s.button, s.primary]}
                onPress={() =>
                  router.push({
                    pathname: "/composicao-saldo",
                    params: {
                      household,
                      account: detail.postings[0].accountId,
                      currency: detail.currency,
                      ...(period ? { period } : {}),
                    },
                  })
                }
              >
                <Text style={{ color: "white" }}>↗ Ver conta</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              style={[s.button, !opening && s.primary]}
              onPress={back}
            >
              <Text style={{ color: opening ? "#315f3b" : "white" }}>
                ← Voltar ao histórico
              </Text>
            </Pressable>
            {!done && ((!opening && canReverse(detail)) || pending) && (
              <Pressable
                accessibilityRole="button"
                style={[s.button, s.reverse]}
                onPress={() => {
                  setDismissed(false);
                  setConfirm(true);
                }}
              >
                <Text style={{ color: "#b33d29" }}>
                  {pending
                    ? "Verificar estorno pendente"
                    : transfer
                      ? "↶ Estornar transferência"
                      : "↶ Estornar lançamento"}
                </Text>
              </Pressable>
            )}
            {corrected && (
              <Text accessibilityLiveRegion="polite" style={s.help}>
                Classificação atualizada com sucesso.
              </Text>
            )}
            {["income", "expense"].includes(detail.kind) && (
              <Pressable
                accessibilityRole="button"
                style={s.button}
                onPress={() => setClassify(true)}
              >
                <Text>
                  {detail.status === "posted"
                    ? "Corrigir classificação"
                    : "Consultar classificação"}
                </Text>
              </Pressable>
            )}
            <Pressable style={s.button} onPress={state.retry}>
              <Text>Atualizar</Text>
            </Pressable>
            {!opening && (
              <Text style={s.help}>
                {transfer
                  ? "O estorno desfaz os dois lados da transferência em uma única operação, mantendo o original."
                  : "O estorno mantém o original e cria uma movimentação de compensação."}
              </Text>
            )}
          </>
        )}
      </ScrollView>
      {classify && (
        <ClassificationSheet
          household={household}
          transactionId={id}
          onClose={() => setClassify(false)}
          onSaved={() => {
            setClassify(false);
            setCorrected(true);
            state.retry();
          }}
        />
      )}
      {!done &&
        ((!opening && canReverse(detail)) || pending || saving) &&
        (confirm || (pending && !dismissed) || saving) && (
          <ReversalSheet
            detail={detail}
            date={state.fields.date}
            description={state.fields.description}
            pending={pending}
            saving={saving}
            notice={state.notice}
            onEdit={state.edit}
            onClose={close}
            onConfirm={() => void state.submit()}
          />
        )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: { padding: 20, gap: 12 },
  back: { paddingVertical: 10 },
  green: { color: "#315f3b" },
  hero: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontFamily: t.serif, fontSize: 25, color: "#214b36" },
  openingArt: { width: "100%", height: 170, resizeMode: "contain" },
  openingNotice: {
    padding: 17,
    borderWidth: 1,
    borderColor: "#efd58f",
    borderRadius: 12,
    backgroundColor: "#fff5d9",
    gap: 8,
  },
  transferArt: { width: "100%", height: 155, resizeMode: "contain" },
  accounts: { gap: 4 },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#e9edd9",
  },
  destination: { backgroundColor: "#f9edcd" },
  arrow: { textAlign: "center", color: "#315f3b", fontSize: 25 },
  art: { width: 110, height: 120, resizeMode: "contain" },
  help: { fontFamily: t.sans, color: t.muted, fontSize: 11, lineHeight: 17 },
  card: {
    padding: 17,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    backgroundColor: "#fffdf5",
    gap: 10,
  },
  heading: { fontFamily: t.serif, fontSize: 20, color: "#214b36" },
  amount: { fontFamily: t.serif, fontSize: 29 },
  status: {
    alignSelf: "flex-start",
    borderRadius: 20,
    padding: 7,
    backgroundColor: "#e3ecd7",
    color: "#2b643c",
    fontSize: 11,
  },
  row: { borderTopWidth: 1, borderColor: t.line, paddingTop: 10, gap: 4 },
  label: { fontSize: 12, color: t.muted },
  value: { fontFamily: t.sans, fontSize: 13, color: t.ink, lineHeight: 20 },
  button: {
    minHeight: 48,
    padding: 13,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fffdf5",
  },
  primary: { backgroundColor: "#315f3b" },
  reverse: { borderColor: "#bd513c" },
  notice: { color: "#94502d", fontSize: 13, lineHeight: 20 },
});
