import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../../theme";

export function VerificationWarning() {
  return (
    <View style={s.cardWarning}>
      <MaterialCommunityIcons
        name="alert-circle"
        size={18}
        color="#d97706"
        accessible={false}
      />
      <Text style={s.warningText}>
        Para evitar duplicidade, não crie outro lançamento igual enquanto verificamos.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  cardWarning: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fef6e5",
    borderWidth: 1,
    borderColor: "#fce3b8",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  warningText: {
    fontFamily: t.sans,
    fontSize: 13,
    color: "#8c4a16",
    lineHeight: 18,
    flex: 1,
  },
});
