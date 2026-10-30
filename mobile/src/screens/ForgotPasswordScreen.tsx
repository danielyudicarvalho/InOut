import { BrandLogo } from "../components/BrandLogo";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRecoveryRequest } from "../auth/use-password-recovery";
import { theme as t } from "../theme";

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const {
    submitted,
    setSubmitted,
    busy,
    notice: error,
    setNotice: setError,
    request,
  } = useRecoveryRequest();
  function submit() {
    void request(email);
  }
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar ao início"
            onPress={() => router.replace("/")}
            style={s.brand}
          >
            <BrandLogo />
          </Pressable>
          <Image
            source={
              submitted
                ? require("../../assets/pipo-recovery-sent.webp")
                : require("../../assets/pipo-recovery-mobile.webp")
            }
            style={s.art}
            resizeMode="contain"
            accessibilityLabel={
              submitted
                ? "Pipo abraçando um envelope"
                : "Pipo segurando uma chave ao lado de um envelope"
            }
          />
          <Text accessibilityRole="header" style={s.title}>
            {submitted ? "Confira seu e-mail" : "Esqueceu sua senha?"}
          </Text>
          {submitted ? (
            <View accessibilityLiveRegion="polite">
              <Text style={s.copy}>
                Se houver um cadastro com esse e-mail, você receberá um link
                para redefinir sua senha.
              </Text>
              <Text style={s.help}>
                Confira também o spam ou lixo eletrônico.
              </Text>
            </View>
          ) : (
            <>
              <Text style={s.copy}>
                Tudo bem. Vamos ajudar você{"\n"}a voltar ao seu Ninho.
              </Text>
              <Text style={s.label}>E-mail</Text>
              <View style={s.field}>
                <MaterialCommunityIcons
                  name="email-outline"
                  size={21}
                  color={t.ink}
                />
                <TextInput
                  accessibilityLabel="E-mail"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  placeholderTextColor={t.muted}
                  style={s.input}
                  returnKeyType="send"
                  onSubmitEditing={submit}
                />
              </View>
              <Text style={s.help}>
                Informe o e-mail usado no seu cadastro.
              </Text>
              {error ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={s.error}
                >
                  {error}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={submit}
                disabled={busy}
                accessibilityState={{ disabled: busy, busy }}
                style={s.primary}
              >
                <Text style={s.primaryText}>
                  {busy ? "Enviando…" : "Enviar link de recuperação"}
                </Text>
              </Pressable>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/entrar")}
            style={submitted ? s.primary : s.back}
          >
            {!submitted && (
              <MaterialCommunityIcons
                name="arrow-left"
                size={18}
                color="#35502a"
              />
            )}
            <Text style={submitted ? s.primaryText : s.link}>
              Voltar para entrar
            </Text>
          </Pressable>
          {submitted && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSubmitted(false)}
              style={s.back}
            >
              <Text style={s.link}>Informar outro e-mail</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    padding: 24,
    paddingBottom: 36,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
  },
  brandText: { fontFamily: t.serif, fontSize: 25, color: t.ink },
  art: { width: "100%", height: 200, borderRadius: 18, marginVertical: 16 },
  title: {
    fontFamily: t.serif,
    fontSize: 29,
    lineHeight: 34,
    textAlign: "center",
    color: t.ink,
  },
  copy: {
    fontFamily: t.sans,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    color: t.ink,
    marginTop: 12,
    marginBottom: 22,
  },
  label: { fontFamily: t.sans, fontSize: 12, color: t.ink, marginBottom: 8 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 50,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: t.line,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.sans,
    fontSize: 14,
    color: t.ink,
    paddingVertical: 12,
  },
  help: {
    fontFamily: t.sans,
    fontSize: 11,
    lineHeight: 17,
    color: t.muted,
    marginTop: 8,
  },
  error: {
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: "#8a321c",
    marginTop: 10,
  },
  primary: {
    minHeight: 48,
    borderRadius: 9,
    backgroundColor: t.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 12,
  },
  primaryText: {
    fontFamily: t.sans,
    color: "white",
    fontSize: 14,
    textAlign: "center",
  },
  preview: {
    fontFamily: t.sans,
    fontSize: 11,
    lineHeight: 17,
    color: t.muted,
    marginVertical: 18,
  },
  back: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  link: {
    fontFamily: t.sans,
    fontSize: 12,
    color: "#35502a",
    textDecorationLine: "underline",
  },
});
