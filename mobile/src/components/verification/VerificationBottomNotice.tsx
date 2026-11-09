import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../../theme";

export function VerificationBottomNotice() {
  return (
    <View style={s.bottomNotice}>
      <MaterialCommunityIcons
        name="sprout"
        size={18}
        color="#2d4a30"
        accessible={false}
      />
      <Text style={s.bottomNoticeText}>
        Você pode sair desta tela e conferir o resultado no histórico.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  bottomNotice: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#edf3ed",
    borderWidth: 1,
    borderColor: "#dbe8db",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bottomNoticeText: {
    fontFamily: t.sans,
    fontSize: 13,
    fontWeight: "500",
    color: "#2d4a30",
    textAlign: "center",
    flexShrink: 1,
  },
});
