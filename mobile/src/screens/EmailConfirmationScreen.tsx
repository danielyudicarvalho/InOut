import { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../theme";

type ConfirmationState = "pending" | "confirmed" | "invalid";
const content = {
  pending: {
    title: "Confirme seu e-mail",
    description: "Abra seu e-mail e toque no link para confirmar seu cadastro.",
    badge: "Confirmação pendente",
    icon: "clock-outline",
  },
  confirmed: {
    title: "E-mail confirmado!",
    description: "Seu acesso está pronto. Entre para continuar.",
    badge: "Confirmação concluída",
    icon: "check-circle-outline",
  },
  invalid: {
    title: "Este link não é válido",
    description:
      "O link pode ter expirado ou já ter sido usado. Tente entrar ou solicite um novo e-mail.",
    badge: "Link indisponível",
    icon: "alert-outline",
  },
} as const;
export function EmailConfirmationScreen({
  state = "pending",
}: {
  state?: ConfirmationState;
}) {
  const [notice, setNotice] = useState("");
  const current = content[state];
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao início"
          onPress={() => router.replace("/")}
          style={s.brand}
        >
          <MaterialCommunityIcons name="sprout" color={t.green} size={28} />
          <Text style={s.brandText}>ninho</Text>
        </Pressable>
        <Image
          source={require("../../assets/pipo-home.webp")}
          style={s.art}
          resizeMode="cover"
          accessibilityLabel="Pipo em seu ninho entre plantas"
        />
        <Text style={s.preview}>
          Prévia de interface · sem validação de e-mail integrada
        </Text>
        <Text accessibilityRole="header" style={s.title}>
          {current.title}
        </Text>
        {state === "pending" && (
          <>
            <Text style={s.text}>Enviamos um link para</Text>
            <Text style={s.email}>voce@exemplo.com</Text>
            <Text style={s.preview}>Endereço ilustrativo desta prévia.</Text>
          </>
        )}
        <View style={[s.badge, state === "confirmed" && s.confirmed]}>
          <MaterialCommunityIcons
            name={current.icon}
            color={state === "confirmed" ? "#35502a" : "#874400"}
            size={19}
          />
          <Text
            style={[s.badgeText, state === "confirmed" && { color: "#35502a" }]}
          >
            {current.badge}
          </Text>
        </View>
        <Text style={[s.text, s.description]}>{current.description}</Text>
        {state === "pending" && (
          <>
            <Text style={s.help}>Depois, volte aqui e entre no Ninho.</Text>
            <View style={s.tip}>
              <MaterialCommunityIcons
                name="email-outline"
                size={17}
                color={t.muted}
              />
              <Text style={[s.help, { flex: 1 }]}>
                Não encontrou? Confira o spam ou lixo eletrônico.
              </Text>
            </View>
          </>
        )}
        {state !== "invalid" && (
          <Pressable
            accessibilityRole="button"
            style={s.primary}
            onPress={() => router.replace("/entrar")}
          >
            <Text style={s.primaryText}>
              {state === "pending"
                ? "Já confirmei • Ir para entrar"
                : "Ir para entrar"}
            </Text>
          </Pressable>
        )}
        {state !== "confirmed" && (
          <Pressable
            accessibilityRole="button"
            style={state === "invalid" ? s.primary : s.secondary}
            onPress={() =>
              setNotice(
                "O reenvio estará disponível quando a autenticação for integrada. Nenhum e-mail foi enviado nesta prévia.",
              )
            }
          >
            <Text style={state === "invalid" ? s.primaryText : s.secondaryText}>
              {state === "invalid"
                ? "Solicitar novo e-mail"
                : "Reenviar e-mail"}
            </Text>
          </Pressable>
        )}
        {notice ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={s.notice}
          >
            {notice}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={s.linkTarget}
          onPress={() => router.replace("/entrar")}
        >
          <Text style={s.link}>Voltar para entrar</Text>
        </Pressable>
        <Text style={s.preview}>Ver estados de demonstração:</Text>
        <View style={s.demos}>
          {(
            [
              { route: "/confirmar-email", label: "Pendente" },
              { route: "/email-confirmado", label: "Confirmado" },
              { route: "/link-invalido", label: "Link inválido" },
            ] as const
          ).map(({ route, label }) => (
            <Pressable
              accessibilityRole="button"
              key={route}
              onPress={() => router.replace(route)}
              style={s.linkTarget}
            >
              <Text style={s.link}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: 24,
    paddingBottom: 32,
  },
  brand: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
  },
  brandText: { fontFamily: t.serif, fontSize: 25, color: t.ink },
  art: { width: "100%", height: 190, borderRadius: 18, marginVertical: 12 },
  preview: {
    fontFamily: t.sans,
    fontSize: 10,
    color: t.muted,
    textAlign: "center",
    lineHeight: 16,
    marginVertical: 8,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 29,
    lineHeight: 34,
    textAlign: "center",
    color: t.ink,
    marginVertical: 12,
  },
  text: {
    fontFamily: t.sans,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: t.ink,
  },
  email: {
    fontFamily: t.sans,
    fontSize: 15,
    fontWeight: "bold",
    color: t.ink,
    textAlign: "center",
    marginTop: 3,
  },
  badge: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 22,
    backgroundColor: "#fbead0",
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginVertical: 14,
  },
  confirmed: { backgroundColor: "#e1ecd7" },
  badgeText: { fontFamily: t.sans, fontSize: 12, color: "#874400" },
  description: { marginTop: 10, marginBottom: 8 },
  help: {
    fontFamily: t.sans,
    fontSize: 11,
    lineHeight: 17,
    color: t.muted,
    textAlign: "center",
  },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderColor: t.line,
    paddingTop: 16,
    marginVertical: 20,
  },
  primary: {
    backgroundColor: t.green,
    borderRadius: 9,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 12,
  },
  primaryText: {
    fontFamily: t.sans,
    fontSize: 14,
    color: "white",
    textAlign: "center",
  },
  secondary: {
    borderWidth: 1,
    borderColor: t.green,
    borderRadius: 9,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryText: { fontFamily: t.sans, color: "#35502a", fontSize: 14 },
  notice: {
    fontFamily: t.sans,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    marginTop: 14,
  },
  linkTarget: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  link: {
    fontFamily: t.sans,
    fontSize: 11,
    color: "#35502a",
    textDecorationLine: "underline",
  },
  demos: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
});
