import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../../theme";

export interface VerificationActionsProps {
  onVerify: () => void;
  onHistory: () => void;
  submitting?: boolean;
}

export function VerificationActions({
  onVerify,
  onHistory,
  submitting = false,
}: VerificationActionsProps) {
  return (
    <View style={s.actions}>
      <Pressable
        accessibilityRole="button"
        style={[s.primaryBtn, submitting && s.btnDisabled]}
        onPress={onVerify}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <MaterialCommunityIcons
            name="refresh"
            size={18}
            color="#ffffff"
            accessible={false}
          />
        )}
        <Text style={s.primaryBtnText}>
          {submitting ? "Verificando…" : "Verificar novamente"}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        style={s.secondaryBtn}
        onPress={onHistory}
      >
        <MaterialCommunityIcons
          name="file-document-outline"
          size={18}
          color="#2d4a30"
          accessible={false}
        />
        <Text style={s.secondaryBtnText}>Ir ao histórico</Text>
      </Pressable>

      <Text style={s.helpText}>
        Ao verificar novamente, consultamos esta mesma operação.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  actions: {
    width: "100%",
    gap: 12,
    marginBottom: 20,
    alignItems: "stretch",
  },
  primaryBtn: {
    backgroundColor: "#2d4a30",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#2d4a30",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontFamily: t.sans,
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  secondaryBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#2d4a30",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: {
    fontFamily: t.sans,
    fontSize: 15,
    fontWeight: "700",
    color: "#2d4a30",
  },
  helpText: {
    fontFamily: t.sans,
    fontSize: 12,
    color: "#7a8579",
    textAlign: "center",
    marginTop: 2,
  },
});
