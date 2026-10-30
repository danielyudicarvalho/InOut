import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { theme as t } from "../../theme";

interface AccountSuccessViewProps {
  context: {
    household: string;
    period: string;
    currency: string;
  };
}

export function AccountSuccessView({ context }: AccountSuccessViewProps) {
  return (
    <View style={s.container}>
      <Text accessibilityLiveRegion="polite" style={s.successNotice}>
        Conta criada com sucesso.
      </Text>

      {(["income", "expense"] as const).map((kind) => (
        <Pressable
          accessibilityRole="button"
          style={s.button}
          key={kind}
          onPress={() =>
            router.push({
              pathname: "/novo-registro",
              params: { ...context, kind },
            })
          }
        >
          <Text style={s.buttonText}>
            Registrar {kind === "income" ? "entrada" : "saída"}
          </Text>
        </Pressable>
      ))}

      <Pressable
        accessibilityRole="button"
        style={s.textButton}
        onPress={() => router.replace({ pathname: "/inicio", params: context })}
      >
        <Text style={s.link}>Ir para o início</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  successNotice: {
    fontFamily: t.sans,
    fontSize: 15,
    fontWeight: "600",
    color: t.green,
    textAlign: "center",
    marginBottom: 8,
  },
  button: {
    backgroundColor: t.green,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
  },
  buttonText: {
    fontFamily: t.sans,
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  textButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  link: {
    fontFamily: t.sans,
    fontSize: 14,
    color: t.green,
    fontWeight: "600",
  },
});
