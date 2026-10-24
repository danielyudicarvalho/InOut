import { useEffect, useState } from "react";
import {
  Text,
  View,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../theme";

type SessionState = "loading" | "expired" | "error";
const copy = {
  loading: {
    title: "Preparando seu Ninho...",
    description: "Estamos verificando seu acesso.",
  },
  expired: {
    title: "Entre novamente",
    description: "Sua sessão expirou. Entre para continuar.",
  },
  error: {
    title: "Não foi possível continuar",
    description:
      "Não conseguimos verificar seu acesso. Confira sua conexão e tente novamente.",
  },
};
export function SessionScreen({
  initialState = "loading",
}: {
  initialState?: SessionState;
}) {
  const [state, setState] = useState(initialState);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (!retrying) return;
    const timer = setTimeout(() => {
      setState("error");
      setRetrying(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [retrying]);
  const current = copy[state];
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao início"
          onPress={() => router.replace("/")}
          style={s.brand}
        >
          <MaterialCommunityIcons name="sprout" size={32} color={t.green} />
          <Text style={s.brandText}>ninho</Text>
        </Pressable>
        <Image
          source={require("../../assets/pipo-home.webp")}
          style={s.art}
          resizeMode="cover"
          accessibilityLabel="Pipo em seu ninho entre plantas"
        />
        <View style={s.icon}>
          {state === "loading" ? (
            <ActivityIndicator
              size="large"
              color={t.green}
              accessibilityLabel="Verificando acesso"
            />
          ) : (
            <MaterialCommunityIcons
              name={state === "expired" ? "key-outline" : "wifi-off"}
              size={38}
              color={t.green}
            />
          )}
        </View>
        <View accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" style={s.title}>
            {current.title}
          </Text>
          <Text style={s.description}>{current.description}</Text>
        </View>
        {state === "error" && (
          <Pressable
            accessibilityRole="button"
            style={s.primary}
            onPress={() => {
              setState("loading");
              setRetrying(true);
            }}
          >
            <Text style={s.primaryText}>Tentar novamente</Text>
          </Pressable>
        )}
        {state !== "loading" && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/entrar")}
            style={state === "expired" ? s.primary : s.linkTarget}
          >
            <Text style={state === "expired" ? s.primaryText : s.link}>
              Ir para entrar
            </Text>
          </Pressable>
        )}
        <Text style={s.preview}>
          Prévia de interface. A restauração de sessão ainda não está integrada.
          {retrying ? " Demonstrando uma nova tentativa." : ""}
        </Text>
        <Text style={s.preview}>Ver estados de demonstração:</Text>
        <View style={s.demos}>
          {(
            [
              { route: "/preparando", label: "Carregando" },
              { route: "/sessao-expirada", label: "Sessão expirada" },
              { route: "/falha-acesso", label: "Falha ao restaurar" },
              { route: "/entrar", label: "Entrar" },
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
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44 },
  brandText: { fontFamily: t.serif, fontSize: 30, color: t.ink },
  art: {
    width: 280,
    maxWidth: "100%",
    height: 210,
    borderRadius: 24,
    marginTop: 22,
  },
  icon: {
    height: 42,
    justifyContent: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 27,
    lineHeight: 33,
    color: t.ink,
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontFamily: t.sans,
    fontSize: 15,
    lineHeight: 23,
    color: t.ink,
    textAlign: "center",
    marginBottom: 22,
  },
  primary: {
    width: "100%",
    maxWidth: 320,
    minHeight: 48,
    backgroundColor: t.green,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryText: { fontFamily: t.sans, fontSize: 14, color: "white" },
  linkTarget: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 7,
  },
  link: {
    fontFamily: t.sans,
    fontSize: 12,
    color: "#35502a",
    textDecorationLine: "underline",
  },
  preview: {
    fontFamily: t.sans,
    fontSize: 11,
    lineHeight: 17,
    color: t.muted,
    textAlign: "center",
    marginTop: 18,
  },
  demos: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 5,
  },
});
