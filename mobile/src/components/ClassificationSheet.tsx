import { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  canCorrectClassification,
  classificationChoices,
  type TransactionDetail,
} from "@inout/finance";
import { useClassification } from "../finance/use-classification";
import { transactionStyles as s } from "./transaction-styles";
export function ClassificationSheet({
  household,
  transactionId,
  onClose,
  onSaved,
  onConflict,
}: {
  household: string;
  transactionId: string;
  onClose: () => void;
  onSaved: () => void;
  onConflict: (detail: TransactionDetail) => void;
}) {
  const state = useClassification(household, transactionId),
    insets = useSafeAreaInsets(),
    busy = state.status === "saving",
    pending = state.status === "uncertain",
    detail = state.options?.detail;
  useEffect(() => {
    if (state.status === "success") onSaved();
    else if (
      detail &&
      (state.status === "stale" ||
        (state.status === "ready" && !canCorrectClassification(detail)))
    )
      onConflict(detail);
  }, [state.status, detail, onSaved, onConflict]);
  const choices = state.options ? classificationChoices(state.options) : null;
  return (
    <Modal
      transparent
      animationType="slide"
      visible
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.sheet} accessibilityViewIsModal>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              s.panel,
              { paddingBottom: Math.max(insets.bottom, 22) },
            ]}
          >
            <View style={s.handle} />
            <Pressable
              style={s.close}
              accessibilityRole="button"
              accessibilityLabel="Fechar correção"
              disabled={busy}
              onPress={onClose}
            >
              <Text style={s.heading}>×</Text>
            </Pressable>
            <Text style={s.title} accessibilityRole="header">
              Corrigir classificação
            </Text>
            <Text style={s.text}>
              O valor, a conta e a data são preservados.
            </Text>
            {state.status === "loading" && (
              <Text style={s.text}>Carregando classificação…</Text>
            )}
            {state.notice ? (
              <Text style={s.warningText} accessibilityRole="alert">
                {state.notice}
              </Text>
            ) : null}
            {state.status === "error" && (
              <Pressable style={s.button} onPress={state.retry}>
                <Text style={s.buttonText}>Tentar novamente</Text>
              </Pressable>
            )}
            {detail &&
              choices &&
              ["ready", "saving", "uncertain"].includes(state.status) && (
                <>
                  <Text style={s.heading}>Categoria</Text>
                  {choices.categories.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        s.button,
                        state.fields.categoryId === c.id && s.selected,
                        (busy || pending || c.disabled) && s.disabled,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: state.fields.categoryId === c.id,
                        disabled: busy || pending || c.disabled,
                      }}
                      disabled={busy || pending || c.disabled}
                      onPress={() => state.edit("categoryId", c.id)}
                    >
                      <Text style={s.buttonText}>{c.name}</Text>
                    </Pressable>
                  ))}
                  {detail.kind === "income" && (
                    <>
                      <Text style={s.heading}>Fonte de renda (opcional)</Text>
                      {choices.sources.map((c) => (
                        <Pressable
                          key={c.id}
                          style={[
                            s.button,
                            state.fields.sourceId === c.id && s.selected,
                            (busy || pending || c.disabled) && s.disabled,
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{
                            checked: state.fields.sourceId === c.id,
                            disabled: busy || pending || c.disabled,
                          }}
                          disabled={busy || pending || c.disabled}
                          onPress={() => state.edit("sourceId", c.id)}
                        >
                          <Text style={s.buttonText}>{c.name}</Text>
                        </Pressable>
                      ))}
                    </>
                  )}
                  <Text style={s.heading}>Descrição</Text>
                  <TextInput
                    style={s.input}
                    accessibilityLabel="Descrição do lançamento"
                    multiline
                    maxLength={500}
                    editable={!busy && !pending}
                    value={state.fields.description}
                    onChangeText={(v) => state.edit("description", v)}
                  />
                  <Pressable
                    style={[s.button, s.primary, busy && s.disabled]}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void state.submit()}
                  >
                    <Text style={[s.buttonText, s.primaryText]}>
                      {busy
                        ? "Salvando…"
                        : pending
                          ? "Verificar mesma tentativa"
                          : "Salvar alterações"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={s.button}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={onClose}
                  >
                    <Text style={s.buttonText}>
                      {pending ? "Fechar sem descartar tentativa" : "Cancelar"}
                    </Text>
                  </Pressable>
                </>
              )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
