import { Modal, View, Text, Image, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { money, historyKind, type TransactionDetail } from "@inout/finance";
import { transactionStyles as s } from "./transaction-styles";
export function TransactionConflictSheet({
  detail,
  busy,
  error,
  onReload,
  onClose,
  onBack,
}: {
  detail: TransactionDetail;
  busy: boolean;
  error: string;
  onReload: () => void;
  onClose: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      animationType="slide"
      visible
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={s.overlay}>
        <View
          style={s.sheet}
          accessibilityViewIsModal
          onAccessibilityEscape={() => {
            if (!busy) onClose();
          }}
        >
          <ScrollView
            contentContainerStyle={[
              s.panel,
              { paddingBottom: Math.max(insets.bottom, 22) },
            ]}
          >
            <View style={s.handle} />
            <Pressable
              style={s.close}
              accessibilityRole="button"
              accessibilityLabel="Fechar aviso"
              disabled={busy}
              onPress={onClose}
            >
              <MaterialCommunityIcons name="close" size={22} color="#526657" />
            </Pressable>
            <Image
              source={require("../../assets/pipo-conflict.webp")}
              style={s.art}
              accessibilityIgnoresInvertColors
            />
            <Text accessibilityRole="header" style={s.title}>
              Este lançamento foi atualizado
            </Text>
            <Text style={s.text}>
              O registro mudou desde que você abriu esta tela.
            </Text>
            <Text style={s.muted}>
              Sua alteração não foi aplicada. Recarregue os dados para conferir
              a versão atual e as ações disponíveis.
            </Text>
            <View style={[s.card, s.row]}>
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
                <Text style={detail.amount < 0 ? s.out : s.income}>
                  {historyKind(detail)} ·{" "}
                  {money(detail.amount, detail.currency)}
                </Text>
                <Text style={s.muted}>
                  {detail.postings.map((p) => p.accountName).join(" → ")}
                </Text>
              </View>
            </View>
            <View style={[s.warning, s.row]}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={22}
                color="#df8517"
              />
              <Text style={s.warningText}>
                Nenhuma alteração sua foi salva.
              </Text>
            </View>
            {error ? (
              <Text accessibilityRole="alert" style={s.warningText}>
                {error}
              </Text>
            ) : null}
            <Pressable
              style={[s.button, s.primary, busy && s.disabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={onReload}
            >
              <MaterialCommunityIcons name="sync" size={20} color="white" />
              <Text style={[s.buttonText, s.primaryText]}>
                {busy ? "Recarregando…" : "Recarregar dados"}
              </Text>
            </Pressable>
            <Pressable
              style={s.button}
              accessibilityRole="button"
              onPress={onBack}
            >
              <Text style={s.buttonText}>Voltar ao histórico</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
