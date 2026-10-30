import { BrandLogo } from "../components/BrandLogo";
import { useConfirmation } from "../auth/use-confirmation";
import {
  View,
  Text,
  TextInput,
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
  state: initialState = "pending",
}: {
  state?: ConfirmationState;
}) {
  const { state, email, setEmail, token, setToken, notice, busy, act } =
    useConfirmation(initialState);
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
          <BrandLogo />
        </Pressable>
        <Image
          source={require("../../assets/pipo-home.webp")}
          style={s.art}
          resizeMode="cover"
          accessibilityLabel="Pipo em seu ninho entre plantas"
        />
        <Text accessibilityRole="header" style={s.title}>
          {current.title}
        </Text>
        {state === "pending" && (
          <>
            <Text style={s.text}>Confira o e-mail do cadastro</Text>
            <Text style={s.email}>{email}</Text>
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
          <>
            <Text style={s.help}>E-mail do cadastro</Text>
            <TextInput
              accessibilityLabel="E-mail do cadastro"
              style={s.authInput}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            <Text style={s.help}>Código recebido por e-mail</Text>
            <TextInput
              accessibilityLabel="Código recebido por e-mail"
              style={s.authInput}
              value={token}
              onChangeText={setToken}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={10}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              accessibilityState={{ disabled: busy, busy }}
              style={s.primary}
              onPress={() => void act("confirm")}
            >
              <Text style={s.primaryText}>
                {busy ? "Aguarde…" : "Confirmar código"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              accessibilityState={{ disabled: busy, busy }}
              style={s.secondary}
              onPress={() => void act("resend")}
            >
              <Text style={s.secondaryText}>Reenviar e-mail</Text>
            </Pressable>
          </>
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
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  authInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: t.ink,
    fontFamily: t.sans,
    marginVertical: 8,
  },
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
