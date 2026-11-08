import { useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { authMessage } from "@inout/identity";
import { getAuth } from "../auth/composition";
import { theme as t } from "../theme";

export function HostedAccountScreen({
  title,
  body,
  path,
}: {
  title: string;
  body: string;
  path:
    | "/account/register"
    | "/account/confirm"
    | "/account/forgot"
    | "/account/reset";
}) {
  const [notice, setNotice] = useState("");
  async function open() {
    try {
      await getAuth().openHostedAccount(path);
    } catch (error) {
      setNotice(authMessage(error));
    }
  }
  return (
    <SafeAreaView style={s.safe}>
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      <Text style={s.body}>{body}</Text>
      <Pressable accessibilityRole="button" onPress={open} style={s.button}>
        <Text style={s.buttonText}>Continuar no navegador</Text>
      </Pressable>
      {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={s.link}>Voltar</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream, padding: 24, gap: 16 },
  title: { fontFamily: t.serif, fontSize: 32, color: t.ink },
  body: { fontFamily: t.sans, fontSize: 16, color: t.ink, lineHeight: 22 },
  button: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: t.green,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "white", fontFamily: t.sans, fontSize: 16 },
  link: { fontFamily: t.sans, color: t.ink, textDecorationLine: "underline" },
});
