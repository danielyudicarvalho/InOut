import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  canCorrectClassification,
  historyKind,
  money,
  type TransactionDetail,
} from "@inout/finance";
import { useTransactionDetail } from "../finance/use-transaction-detail";
import { ClassificationSheet } from "../components/ClassificationSheet";
import { TransactionConflictSheet } from "../components/TransactionConflictSheet";
import { transactionStyles as s } from "../components/transaction-styles";
export function TransactionDetailScreen() {
  const p = useLocalSearchParams();
  return (
    <Detail
      key={`${p.household}:${p.transaction}`}
      household={typeof p.household === "string" ? p.household : ""}
      transaction={typeof p.transaction === "string" ? p.transaction : ""}
      period={typeof p.period === "string" ? p.period : ""}
    />
  );
}
function Detail({
  household,
  transaction,
  period,
}: {
  household: string;
  transaction: string;
  period: string;
}) {
  const state = useTransactionDetail(household, transaction),
    detail = state.detail;
  const [editing, setEditing] = useState(false),
    [conflict, setConflict] = useState<TransactionDetail | null>(null),
    [blocked, setBlocked] = useState(false),
    [conflictOpen, setConflictOpen] = useState(false),
    [saved, setSaved] = useState(false);
  const back = () =>
      router.replace({
        pathname: "/lancamentos",
        params: { household, ...(period ? { period } : {}) },
      }),
    target = (id: string) =>
      router.push({
        pathname: "/lancamento",
        params: { household, transaction: id, ...(period ? { period } : {}) },
      });
  async function reload() {
    setEditing(false);
    if (await state.reload()) {
      setBlocked(false);
      setConflictOpen(false);
      setConflict(null);
    }
  }
  function changed(snapshot: TransactionDetail) {
    setEditing(false);
    setConflict(snapshot);
    setBlocked(true);
    setConflictOpen(true);
    setSaved(false);
  }
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        accessibilityElementsHidden={editing || conflictOpen}
        importantForAccessibility={
          editing || conflictOpen ? "no-hide-descendants" : "auto"
        }
      >
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar ao histórico"
            onPress={back}
          >
            <Text style={s.text}>‹ Voltar</Text>
          </Pressable>
          <Text style={s.title} accessibilityRole="header">
            Lançamento
          </Text>
        </View>
        {state.refreshed && (
          <Text style={s.refreshed} accessibilityLiveRegion="polite">
            ↻ Dados atualizados
          </Text>
        )}
        {state.status === "loading" && (
          <Text style={s.text} accessibilityLiveRegion="polite">
            Carregando lançamento…
          </Text>
        )}
        {state.status === "error" && (
          <>
            <Text style={s.warningText} accessibilityRole="alert">
              {state.notice}
            </Text>
            <Pressable
              style={[s.button, s.primary]}
              onPress={() => void reload()}
              accessibilityRole="button"
            >
              <Text style={s.primaryText}>Tentar novamente</Text>
            </Pressable>
          </>
        )}
        {saved && <Text style={s.text}>Classificação salva com sucesso.</Text>}
        {detail && (
          <>
            <View style={s.card}>
              <View style={s.row}>
                <View style={s.icon}>
                  <MaterialCommunityIcons
                    name={
                      detail.kind === "transfer"
                        ? "swap-horizontal"
                        : detail.amount < 0
                          ? "cart-outline"
                          : "cash-plus"
                    }
                    size={25}
                    color="#b6382d"
                  />
                </View>
                <View style={s.grow}>
                  <Text style={s.heading}>{detail.description}</Text>
                  <Text
                    style={[
                      detail.amount < 0 ? s.out : s.income,
                      detail.status === "reversed" && s.crossed,
                    ]}
                  >
                    {historyKind(detail)} ·{" "}
                    {money(detail.amount, detail.currency)}
                  </Text>
                  <Text style={s.muted}>
                    {detail.postings.map((p) => p.accountName).join(" → ")}
                  </Text>
                </View>
                <Text
                  style={[s.status, detail.status === "reversed" && s.reversed]}
                >
                  {detail.status === "reversed" ? "Estornado" : "Registrado"}
                </Text>
              </View>
              {detail.rows.map((row, i) => (
                <View style={s.field} key={i}>
                  <Text style={s.label}>{row.label}</Text>
                  <Text style={s.value}>{row.value}</Text>
                </View>
              ))}
              {detail.status === "reversed" && (
                <View style={s.warning}>
                  <View style={s.row}>
                    <MaterialCommunityIcons
                      name="alert-circle"
                      size={24}
                      color="#df8517"
                    />
                    <Text style={[s.warningText, s.grow]}>
                      Este lançamento já foi estornado. Você pode consultar a
                      compensação.
                    </Text>
                  </View>
                  {detail.reversalId && (
                    <Pressable
                      style={[s.button, s.primary]}
                      onPress={() => target(detail.reversalId!)}
                      accessibilityRole="button"
                    >
                      <Text style={s.primaryText}>Ver estorno</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={s.button}
                    onPress={back}
                    accessibilityRole="button"
                  >
                    <Text style={s.buttonText}>Voltar ao histórico</Text>
                  </Pressable>
                </View>
              )}
              {blocked && (
                <View style={s.warning}>
                  <Text style={s.warningText}>
                    Este lançamento mudou. Recarregue os dados antes de
                    continuar.
                  </Text>
                  <Pressable
                    style={s.button}
                    accessibilityRole="button"
                    onPress={() => setConflictOpen(true)}
                  >
                    <Text style={s.buttonText}>Ver aviso</Text>
                  </Pressable>
                </View>
              )}
              {detail.reversalOf && (
                <Pressable
                  style={s.button}
                  accessibilityRole="button"
                  onPress={() => target(detail.reversalOf!)}
                >
                  <Text style={s.buttonText}>Ver lançamento original</Text>
                </Pressable>
              )}
            </View>
            <View style={s.card}>
              <Text style={s.heading}>Histórico disponível</Text>
              <Text style={s.muted}>Registrado por (usuário)</Text>
              <Text style={s.text} selectable>
                {detail.createdBy}
              </Text>
              <Text style={s.muted}>Registrado em</Text>
              <Text style={s.text}>
                {new Date(detail.postedAt).toLocaleString("pt-BR")} (horário do
                dispositivo)
              </Text>
              <Text style={s.muted}>Identificador</Text>
              <Text style={s.text} selectable>
                {detail.id}
              </Text>
              <Text style={s.muted}>
                Consulte a autoria e a data de cada movimentação no respectivo
                detalhe.
              </Text>
            </View>
            {canCorrectClassification(detail) && !blocked && (
              <Pressable
                style={[s.button, s.primary]}
                accessibilityRole="button"
                onPress={() => setEditing(true)}
              >
                <Text style={s.primaryText}>Corrigir classificação</Text>
              </Pressable>
            )}
            <Pressable
              style={s.button}
              accessibilityRole="button"
              onPress={() => void reload()}
            >
              <MaterialCommunityIcons name="sync" size={20} color="#244a3c" />
              <Text style={s.buttonText}>Recarregar dados</Text>
            </Pressable>
          </>
        )}
        <Pressable style={s.button} accessibilityRole="button" onPress={back}>
          <Text style={s.buttonText}>Voltar ao histórico</Text>
        </Pressable>
      </ScrollView>
      {editing && (
        <ClassificationSheet
          household={household}
          transactionId={transaction}
          onClose={() => setEditing(false)}
          onConflict={changed}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
            void reload();
          }}
        />
      )}
      {conflictOpen && conflict && (
        <TransactionConflictSheet
          detail={conflict}
          busy={state.status === "loading"}
          error={state.status === "error" ? state.notice : ""}
          onReload={() => void reload()}
          onClose={() => setConflictOpen(false)}
          onBack={back}
        />
      )}
    </SafeAreaView>
  );
}
