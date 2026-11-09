import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  displayDate,
  historyKind,
  money,
  reversalEffects,
  type TransactionDetail,
} from "@inout/finance";
import { DateSelector } from "./AuxiliarySelector";
import { theme as t } from "../theme";
type Props = {
  detail: TransactionDetail;
  date: string;
  description: string;
  pending: boolean;
  saving: boolean;
  notice: string;
  onEdit: (field: "date" | "description", value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};
export function ReversalSheet({
  detail,
  date,
  description,
  pending,
  saving,
  notice,
  onEdit,
  onClose,
  onConfirm,
}: Props) {
  const [showDate, setShowDate] = useState(false),
    effects = reversalEffects(detail),
    classification = detail.rows
      .filter((r) => ["Categoria", "Subcategoria"].includes(r.label))
      .map((r) => r.value)
      .join(" › ");
  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.sheet} accessibilityViewIsModal>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            <View style={s.header}>
              <Text accessibilityRole="header" style={s.title}>
                {pending
                  ? "Estorno com confirmação pendente"
                  : "Confirmar estorno"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar confirmação"
                disabled={saving}
                onPress={onClose}
                style={s.close}
              >
                <Text>×</Text>
              </Pressable>
            </View>
            <Text style={s.help}>
              Confira o lançamento e o efeito desta ação.
            </Text>
            <Image
              source={require("../../assets/pipo-reversal.webp")}
              style={s.art}
            />
            <View style={s.original}>
              <Text style={s.label}>Lançamento original</Text>
              <Text style={s.name}>{detail.description}</Text>
              <Text
                style={[
                  s.amount,
                  { color: detail.amount < 0 ? "#b5432c" : "#315f3b" },
                ]}
              >
                {money(detail.amount, detail.currency)}
              </Text>
              <Text style={s.help}>{historyKind(detail)}</Text>
              <Text style={s.help}>
                {detail.postings.map((p) => p.accountName).join(" → ")}
              </Text>
              {!!classification && <Text style={s.help}>{classification}</Text>}
              <Text style={s.help}>{displayDate(detail.date)}</Text>
            </View>
            <View style={s.effect}>
              <Text style={s.label}>O que vai acontecer?</Text>
              {effects.map((effect, i) => (
                <Text key={i} style={s.explanation}>
                  Será criado um {effect.amount < 0 ? "débito" : "crédito"} de{" "}
                  {money(Math.abs(effect.amount), effect.currency)} na conta{" "}
                  {effect.accountName}.
                </Text>
              ))}
              <Text style={s.explanation}>
                O lançamento original continuará no histórico, marcado como
                estornado.
              </Text>
            </View>
            <Text style={s.bank}>
              Isso corrige os registros no Ninho. Não realiza reembolso
              bancário.
            </Text>
            {!!notice && (
              <Text accessibilityRole="alert" style={s.explanation}>
                {notice}
              </Text>
            )}
            <Text style={s.label}>Motivo do estorno{!pending ? " *" : ""}</Text>
            <TextInput
              accessibilityLabel="Motivo do estorno"
              multiline
              maxLength={500}
              editable={!pending && !saving}
              value={description}
              onChangeText={(value) => onEdit("description", value)}
              placeholder={
                pending && !description
                  ? "Motivo não informado na tentativa anterior"
                  : "Informe o motivo da correção"
              }
              style={s.input}
            />
            <Text style={s.help}>
              Informe o motivo para manter o histórico da correção. Campo
              obrigatório para novos estornos.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showDate }}
              style={s.dateButton}
              onPress={() => setShowDate((v) => !v)}
            >
              <Text style={s.help}>
                Data do estorno: {displayDate(date)} {showDate ? "▴" : "▾"}
              </Text>
            </Pressable>
            {showDate && (
              <DateSelector
                value={date}
                disabled={pending || saving}
                onChange={(value) => onEdit("date", value)}
              />
            )}
            <View style={s.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={onClose}
                style={s.button}
              >
                <Text style={s.explanation}>
                  {pending ? "Fechar sem descartar tentativa" : "Cancelar"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={onConfirm}
                style={[s.button, s.confirm]}
              >
                <Text style={{ color: "white", textAlign: "center" }}>
                  {saving
                    ? "Estornando…"
                    : pending
                      ? "Verificar mesma tentativa"
                      : "Confirmar estorno"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#14231e88",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "94%",
    backgroundColor: t.cream,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  content: { padding: 20, paddingBottom: 36, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontFamily: t.serif, fontSize: 24, color: t.ink },
  close: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  art: { width: "100%", height: 120, resizeMode: "contain" },
  help: { fontSize: 11, lineHeight: 17, color: t.muted },
  label: { fontSize: 12, fontWeight: "600", color: t.ink },
  name: { fontFamily: t.serif, fontSize: 16, color: t.ink },
  amount: { fontSize: 16, fontWeight: "600" },
  original: {
    padding: 13,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
    gap: 5,
  },
  effect: { padding: 13, borderRadius: 10, gap: 5, backgroundColor: "#e9edd9" },
  explanation: { fontSize: 12, lineHeight: 18, color: t.ink },
  bank: {
    backgroundColor: "#fbefcf",
    padding: 12,
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 18,
    color: t.ink,
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fffdf5",
    color: t.ink,
    textAlignVertical: "top",
  },
  dateButton: { minHeight: 44, justifyContent: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    flex: 1,
    minWidth: 110,
    minHeight: 48,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 8,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  confirm: { backgroundColor: "#ac432f", borderColor: "#ac432f" },
});
