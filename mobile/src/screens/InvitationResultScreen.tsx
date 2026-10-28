import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../theme";

type InvitationResult = "accepted" | "expired" | "invalid" | "used";
const results = {
  accepted: {
    title: "Convite aceito!",
    description: "Você agora faz parte da residência Ninho da Família.",
    primary: "Acessar residência",
    secondary: null,
    image: require("../../assets/pipo-invite-accepted.webp"),
    alt: "Pipo feliz ao lado de uma casa e um sinal de confirmação",
  },
  expired: {
    title: "Este convite expirou",
    description: "Peça um novo convite a quem convidou você.",
    primary: "Informar outro código",
    secondary: "Voltar ao início",
    image: require("../../assets/pipo-invite-expired.webp"),
    alt: "Pipo com um envelope e um relógio",
  },
  invalid: {
    title: "Não encontramos este convite",
    description: "Confira o código informado ou peça um novo convite.",
    primary: "Revisar código",
    secondary: "Voltar ao início",
    image: require("../../assets/pipo-invite-invalid.webp"),
    alt: "Pipo com um envelope e um ponto de interrogação",
  },
  used: {
    title: "Este convite já foi utilizado",
    description:
      "Se você já participa da residência, acesse-a. Caso contrário, peça um novo convite.",
    primary: "Ver minhas residências",
    secondary: "Informar outro código",
    image: require("../../assets/pipo-invite-used.webp"),
    alt: "Pipo ao lado de um envelope aberto e um símbolo de informação",
  },
};
export function InvitationResultScreen({
  result,
}: {
  result: InvitationResult;
}) {
  const [notice, setNotice] = useState("");
  const current = results[result];
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao início"
          onPress={() => router.replace("/")}
          style={s.brand}
        >
          <MaterialCommunityIcons name="sprout" size={30} color={t.green} />
          <Text style={s.brandText}>ninho</Text>
        </Pressable>
        <Image
          source={current.image}
          style={s.art}
          resizeMode="contain"
          accessibilityLabel={current.alt}
        />
        <Text accessibilityRole="header" style={s.title}>
          {current.title}
        </Text>
        <Text style={s.description}>{current.description}</Text>
        <Pressable
          accessibilityRole="button"
          style={s.primary}
          onPress={() => {
            if (result === "expired" || result === "invalid")
              router.replace("/entrar-convite");
            else
              setNotice(
                "O acesso às residências estará disponível em uma próxima etapa. Esta prévia não altera sua participação.",
              );
          }}
        >
          <Text style={s.primaryText}>{current.primary}</Text>
        </Pressable>
        {current.secondary && (
          <Pressable
            accessibilityRole="button"
            style={s.linkTarget}
            onPress={() =>
              router.replace(result === "used" ? "/entrar-convite" : "/comecar")
            }
          >
            <Text style={s.link}>{current.secondary}</Text>
          </Pressable>
        )}
        <Text accessibilityLiveRegion="polite" style={s.notice}>
          {notice}
        </Text>
        <Text style={s.preview}>
          Prévia de interface com dados fictícios. Nenhum convite foi consultado
          ou aceito; nenhuma participação foi alterada.
        </Text>
        <Text style={s.preview}>Ver resultados de demonstração:</Text>
        <View style={s.demos}>
          {(
            [
              { route: "/convite-aceito", label: "Aceito" },
              { route: "/convite-expirado", label: "Expirado" },
              { route: "/convite-invalido", label: "Inválido" },
              { route: "/convite-utilizado", label: "Já utilizado" },
            ] as const
          ).map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.route}
              onPress={() => router.replace(item.route)}
              style={s.linkTarget}
            >
              <Text style={s.link}>{item.label}</Text>
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
    padding: 24,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    flexGrow: 1,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  brandText: { fontFamily: t.serif, fontSize: 28, color: t.ink },
  art: { width: "100%", height: 210, marginTop: 30, marginBottom: 16 },
  title: {
    fontFamily: t.serif,
    fontSize: 29,
    lineHeight: 35,
    color: t.ink,
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontFamily: t.sans,
    fontSize: 15,
    lineHeight: 22,
    color: t.ink,
    textAlign: "center",
    marginBottom: 24,
  },
  primary: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: t.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryText: {
    fontFamily: t.sans,
    fontSize: 15,
    color: "white",
    textAlign: "center",
  },
  linkTarget: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  link: {
    fontFamily: t.sans,
    fontSize: 12,
    color: "#35502a",
    textDecorationLine: "underline",
  },
  notice: {
    fontFamily: t.sans,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    marginTop: 12,
  },
  preview: {
    fontFamily: t.sans,
    fontSize: 10,
    lineHeight: 16,
    color: t.muted,
    textAlign: "center",
    marginTop: 14,
  },
  demos: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
  },
});
