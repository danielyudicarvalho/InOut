import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme as t } from "../../theme";

export const ACCOUNT_KINDS: [string, string][] = [
  ["checking", "Conta corrente"],
  ["cash", "Carteira"],
  ["savings", "Poupança"],
  ["investment", "Investimento"],
  ["other", "Outro"],
];

interface AccountKindPickerModalProps {
  visible: boolean;
  selectedKind: string;
  onSelect: (kind: string) => void;
  onClose: () => void;
}

export function AccountKindPickerModal({
  visible,
  selectedKind,
  onSelect,
  onClose,
}: AccountKindPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.modal} accessibilityViewIsModal>
          <Text style={s.modalTitle}>Tipo de conta</Text>
          {ACCOUNT_KINDS.map(([id, label]) => {
            const isSelected = selectedKind === id;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                key={id}
                style={[s.optionItem, isSelected && s.optionItemSelected]}
                onPress={() => onSelect(id)}
              >
                <Text
                  style={[s.optionText, isSelected && s.optionTextSelected]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            style={s.cancelButton}
            onPress={onClose}
          >
            <Text style={s.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  modalTitle: {
    fontFamily: t.serif,
    fontSize: 18,
    fontWeight: "700",
    color: t.ink,
    marginBottom: 8,
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  optionItemSelected: {
    backgroundColor: "#f4f8f3",
  },
  optionText: {
    fontFamily: t.sans,
    fontSize: 15,
    color: t.ink,
  },
  optionTextSelected: {
    fontWeight: "700",
    color: t.green,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelText: {
    fontFamily: t.sans,
    fontSize: 14,
    color: t.muted,
  },
});
