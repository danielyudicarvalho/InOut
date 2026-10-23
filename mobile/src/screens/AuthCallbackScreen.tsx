import { useEffect, useState } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { authMessage } from "@inout/identity";
import { getAuth } from "../auth/composition";
import { theme as t } from "../theme";
let exchange: { code: string; result: Promise<void> } | undefined;
export function AuthCallbackScreen() {
  const { code, error } = useLocalSearchParams<{
    code?: string;
    error?: string;
  }>();
  const [notice, setNotice] = useState("Confirmando seu acesso…");
  useEffect(() => {
    let active = true;
    if (typeof code !== "string" || error) {
      router.replace("/link-invalido");
      return;
    }
    if (exchange?.code !== code)
      exchange = {
        code,
        result: (async () => {
          const auth = getAuth();
          await auth.exchangeCode(code);
          const user = await auth.currentUser();
          if (!user?.emailConfirmed) throw new Error("confirmation");
        })(),
      };
    exchange.result
      .then(() => {
        if (active) router.replace("/email-confirmado");
      })
      .catch((e) => {
        if (active)
          setNotice(
            authMessage(e) +
              " Você pode entrar ou confirmar com o código recebido por e-mail.",
          );
      });
    return () => {
      active = false;
    };
  }, [code, error]);
  return (
    <SafeAreaView style={s.content}>
      <Text accessibilityRole="header" style={s.title}>
        Confirmação de e-mail
      </Text>
      <Text accessibilityLiveRegion="polite" style={s.text}>
        {notice}
      </Text>
      <Pressable
        accessibilityRole="button"
        style={s.action}
        onPress={() => router.replace("/confirmar-email")}
      >
        <Text style={s.text}>Confirmar com código</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={s.action}
        onPress={() => router.replace("/entrar")}
      >
        <Text style={s.text}>Ir para entrar</Text>
      </Pressable>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: t.cream,
    padding: 24,
    justifyContent: "center",
  },
  title: { fontFamily: t.serif, fontSize: 28, color: t.ink },
  text: { fontFamily: t.sans, fontSize: 15, lineHeight: 23, color: t.ink },
  action: { minHeight: 48, justifyContent: "center", marginTop: 16 },
});
