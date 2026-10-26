import { useEffect } from "react";
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
import { useSessionRestoration } from "../auth/use-session-restoration";
import { theme as t } from "../theme";
export type SessionState = "loading" | "expired" | "error";
const content = {
  loading: {
    title: "Preparando seu Ninho...",
    description: "Estamos verificando seu acesso.",
    art: require("../../assets/pipo-session-loading.webp"),
    alt: "Pipo sentado em seu ninho entre flores",
  },
  expired: {
    title: "Entre novamente",
    description: "Sua sessão expirou. Entre para continuar.",
    art: require("../../assets/pipo-session-expired.webp"),
    alt: "Pipo ao lado de uma chave dourada",
  },
  error: {
    title: "Não foi possível continuar",
    description:
      "Não conseguimos verificar seu acesso. Confira sua conexão e tente novamente.",
    art: require("../../assets/pipo-session-error.webp"),
    alt: "Pipo com um símbolo de conexão indisponível",
  },
};
export function SessionView({
  state,
  notice = "",
  onRetry,
}: {
  state: SessionState;
  notice?: string;
  onRetry?: () => void;
}) {
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
          <MaterialCommunityIcons name="sprout" size={32} color={t.green} />
          <Text style={s.brandText}>ninho</Text>
        </Pressable>
        <Image
          source={current.art}
          style={s.art}
          resizeMode="contain"
          accessibilityLabel={current.alt}
        />
        {state === "loading" ? (
          <ActivityIndicator
            size="large"
            color={t.green}
            accessibilityLabel="Verificando acesso"
            style={s.spinner}
          />
        ) : null}
        <View accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" style={s.title}>
            {current.title}
          </Text>
          <Text style={s.description}>{current.description}</Text>
          {notice ? <Text style={s.detail}>{notice}</Text> : null}
        </View>
        {state === "error" && onRetry ? (
          <Pressable
            accessibilityRole="button"
            style={s.primary}
            onPress={onRetry}
          >
            <Text style={s.primaryText}>Tentar novamente</Text>
          </Pressable>
        ) : null}
        {state !== "loading" ? (
          <Pressable
            accessibilityRole="button"
            style={state === "expired" ? s.primary : s.linkTarget}
            onPress={() => router.replace("/entrar")}
          >
            <Text style={state === "expired" ? s.primaryText : s.link}>
              Ir para entrar
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
export function SessionScreen({
  initialState = "loading",
}: {
  initialState?: SessionState;
}) {
  return initialState === "loading" ? (
    <RestoringSessionScreen />
  ) : (
    <SessionView
      state={initialState}
      onRetry={() => router.replace("/preparando")}
    />
  );
}
function RestoringSessionScreen() {
  const { status, notice, retry } = useSessionRestoration();
  useEffect(() => {
    if (status === "authenticated") router.replace("/comecar");
    else if (status === "confirmationRequired")
      router.replace("/confirmar-email");
  }, [status]);
  return (
    <SessionView
      state={
        status === "expired"
          ? "expired"
          : status === "error"
            ? "error"
            : "loading"
      }
      notice={notice}
      onRetry={() => void retry()}
    />
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
  art: { width: "100%", maxWidth: 340, height: 200, marginTop: 22 },
  spinner: { marginTop: 12, marginBottom: 18 },
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
  detail: {
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: t.muted,
    textAlign: "center",
    marginBottom: 18,
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
});
