import { useEffect } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  canCorrectClassification,
  classificationChoices,
  displayDate,
  historyKind,
  money,
} from "@inout/finance";
import { useClassification } from "../finance/use-classification";
import { AuxiliarySelector } from "./AuxiliarySelector";
import { theme as t } from "../theme";
export function ClassificationSheet({
  household,
  transactionId,
  onClose,
  onSaved,
}: {
  household: string;
  transactionId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const state = useClassification(household, transactionId),
    saving = state.status === "saving",
    pending = state.status === "uncertain";
  useEffect(() => {
    if (state.status === "success") onSaved();
  }, [state.status, onSaved]);
  const options = state.options,
    detail = options?.detail,
    choices = options ? classificationChoices(options) : null,
    editable = !!detail && canCorrectClassification(detail);
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
                Corrigir classificação
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar correção"
                disabled={saving}
                onPress={onClose}
                style={s.close}
              >
                <Text>×</Text>
              </Pressable>
            </View>
            <Text style={s.help}>Ajuste as informações deste lançamento.</Text>
            <Image
              source={require("../../assets/pipo-classification.webp")}
              style={s.art}
            />
            {state.status === "loading" && (
              <Text accessibilityLiveRegion="polite">
                Carregando classificação…
              </Text>
            )}
            {!!state.notice && (
              <Text accessibilityRole="alert" style={s.help}>
                {state.notice}
              </Text>
            )}
            {state.status === "error" && (
              <Pressable style={s.button} onPress={state.retry}>
                <Text>Tentar novamente</Text>
              </Pressable>
            )}
            {detail && (
              <View style={s.summary}>
                <Text style={s.value}>
                  {historyKind(detail)} ·{" "}
                  {money(detail.amount, detail.currency)}
                </Text>
                <Text style={s.help}>
                  {detail.postings[0].accountName} · {displayDate(detail.date)}
                </Text>
              </View>
            )}
            {detail && !editable && !pending && (
              <Text style={s.help}>
                Este lançamento não pode ser corrigido. Apenas entradas e saídas
                registradas permitem alterar a classificação.
              </Text>
            )}
            {detail && choices && (editable || pending) && (
              <>
                <Text style={s.label}>Categoria</Text>
                <AuxiliarySelector
                  title="Categoria"
                  value={state.fields.categoryId}
                  items={choices.categories}
                  disabled={saving || pending}
                  onChange={(v) => state.edit("categoryId", v)}
                />
                {detail.kind === "income" && (
                  <>
                    <Text style={s.label}>Fonte de renda (opcional)</Text>
                    <AuxiliarySelector
                      title="Fonte de renda"
                      value={state.fields.sourceId}
                      items={choices.sources}
                      disabled={saving || pending}
                      onChange={(v) => state.edit("sourceId", v)}
                    />
                    <Text style={s.help}>
                      Use uma fonte para identificar de onde veio a receita.
                    </Text>
                  </>
                )}
                <Text style={s.label}>Descrição</Text>
                <TextInput
                  accessibilityLabel="Descrição do lançamento"
                  multiline
                  maxLength={500}
                  editable={!saving && !pending}
                  value={state.fields.description}
                  onChangeText={(v) => state.edit("description", v)}
                  style={s.input}
                />
                <Text style={s.help}>
                  As alterações preservam o valor, a conta e a data do
                  lançamento.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void state.submit()}
                  style={[s.button, s.primary]}
                >
                  <Text style={{ color: "white" }}>
                    {saving
                      ? "Salvando…"
                      : pending
                        ? "Verificar mesma tentativa"
                        : "Salvar alterações"}
                  </Text>
                </Pressable>
              </>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onClose}
              style={s.button}
            >
              <Text>
                {pending ? "Fechar sem descartar tentativa" : "Cancelar"}
              </Text>
            </Pressable>
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
  content: { padding: 22, paddingBottom: 36, gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { fontFamily: t.serif, fontSize: 25, color: t.ink, flex: 1 },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  art: { width: "100%", height: 110, resizeMode: "contain" },
  help: { color: t.muted, fontSize: 12, lineHeight: 18 },
  label: { color: t.ink, fontSize: 13 },
  value: { fontFamily: t.serif, fontSize: 15, color: t.ink },
  summary: {
    padding: 13,
    borderRadius: 10,
    backgroundColor: "#e9edd9",
    gap: 5,
  },
  input: {
    minHeight: 90,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fffdf5",
    color: t.ink,
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.line,
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  primary: { backgroundColor: "#315f3b" },
});
