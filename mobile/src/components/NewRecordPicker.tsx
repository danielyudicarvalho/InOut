import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
export function NewRecordPicker({
  household,
  period,
  currency,
  onClose,
  fresh = false,
}: {
  household: string;
  period: string;
  currency: string;
  onClose: () => void;
  fresh?: boolean;
}) {
  const [draft] = useState(() => Date.now().toString(36));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Fechar novo registro"
          onPress={onClose}
        />
        <View style={s.sheet} accessibilityViewIsModal>
          <View style={s.handle} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar novo registro"
            onPress={onClose}
            style={s.close}
          >
            <MaterialCommunityIcons name="close" size={24} color="#5f6252" />
          </Pressable>
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            <Image
              source={require("../../assets/pipo-new-record.webp")}
              style={s.art}
              resizeMode="contain"
              accessibilityLabel="Pipo escrevendo em um caderno"
            />
            <Text accessibilityRole="header" style={s.title}>
              O que vamos registrar?
            </Text>
            <Text style={s.subtitle}>Escolha o tipo de movimentação.</Text>
            {[
              {
                kind: "income",
                title: "Nova entrada",
                description: "Registre um dinheiro que entrou.",
                icon: "arrow-up",
                color: "#386f45",
                background: "#eef3dc",
              },
              {
                kind: "expense",
                title: "Nova saída",
                description: "Registre um gasto do seu lar.",
                icon: "arrow-down",
                color: "#bd3c28",
                background: "#fde6da",
              },
              {
                kind: "transfer",
                title: "Transferência",
                description: "Mova dinheiro entre suas contas.",
                icon: "swap-horizontal",
                color: "#b98325",
                background: "#fff0d4",
              },
            ].map((item) => (
              <Pressable
                key={item.kind}
                accessibilityRole="button"
                style={[s.choice, { backgroundColor: item.background }]}
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: "/novo-registro",
                    params: {
                      household,
                      period,
                      currency,
                      kind: item.kind,
                      ...(fresh ? { draft } : {}),
                    },
                  });
                }}
              >
                <View style={[s.icon, { backgroundColor: item.color }]}>
                  <MaterialCommunityIcons
                    name={
                      item.icon as "arrow-up" | "arrow-down" | "swap-horizontal"
                    }
                    size={27}
                    color="white"
                  />
                </View>
                <View style={s.copy}>
                  <Text style={s.choiceTitle}>{item.title}</Text>
                  <Text style={s.description}>{item.description}</Text>
                </View>
                <Text style={{ color: item.color, fontSize: 25 }}>›</Text>
              </Pressable>
            ))}
            <Text style={s.footnote}>
              ⓘ Transferências não contam como receita ou despesa.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#20261c88",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fffbef",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    height: 4,
    width: 38,
    borderRadius: 2,
    backgroundColor: "#d9d1bd",
    alignSelf: "center",
  },
  close: {
    position: "absolute",
    top: 15,
    right: 14,
    zIndex: 1,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20, paddingTop: 5 },
  art: { width: 230, height: 110, alignSelf: "center" },
  title: {
    fontFamily: "Lora_700Bold",
    fontSize: 25,
    color: "#163d29",
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: "#51604f",
    textAlign: "center",
    marginTop: 5,
    marginBottom: 18,
  },
  choice: {
    minHeight: 82,
    borderRadius: 14,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  choiceTitle: { fontFamily: "Lora_700Bold", fontSize: 18, color: "#163d29" },
  description: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#495347",
    marginTop: 3,
  },
  footnote: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#59634f",
    marginTop: 4,
    lineHeight: 18,
  },
});
