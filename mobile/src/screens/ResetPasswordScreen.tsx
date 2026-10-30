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
import { usePasswordReset } from "../auth/use-password-recovery";
import { theme as t } from "../theme";

export function ResetPasswordScreen() {
  const [values, setValues] = useState({ password: "", confirmation: "" });
  const [visible, setVisible] = useState({
    password: false,
    confirmation: false,
  });
  const {
    status,
    complete,
    busy,
    notice: error,
    setNotice: setError,
    reset,
    signOut,
  } = usePasswordReset();
  async function submit() {
    if (await reset(values)) {
      setValues({ password: "", confirmation: "" });
      setVisible({ password: false, confirmation: false });
    }
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
              complete
                ? require("../../assets/pipo-reset-success.webp")
                : require("../../assets/pipo-reset-mobile.webp")
            }
            style={s.art}
            resizeMode="contain"
            accessibilityLabel={
              complete
                ? "Pipo com uma chave e um cadeado confirmado"
                : "Pipo segurando uma chave dourada entre flores"
            }
          />
          <Text accessibilityRole="header" style={s.title}>
            {complete ? "Senha alterada!" : "Definir nova senha"}
          </Text>
          {complete ? (
            <View accessibilityLiveRegion="polite">
              <Text style={s.copy}>
                Sua nova senha foi salva. Entre no Ninho para continuar.
              </Text>
            </View>
          ) : status !== "ready" ? (
            <View>
              <Text accessibilityLiveRegion="polite" style={s.copy}>
                {status === "checking"
                  ? "Validando o link de recuperação…"
                  : "Este link não está disponível ou expirou. Solicite outro e-mail de recuperação."}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={s.primary}
                onPress={() => router.replace("/esqueci-senha")}
              >
                <Text style={s.primaryText}>Solicitar novo link</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={s.copy}>
                Escolha uma nova senha para{"\n"}acessar seu Ninho.
              </Text>
              {(["password", "confirmation"] as const).map((field) => (
                <View key={field}>
                  <Text style={s.label}>
                    {field === "password"
                      ? "Nova senha"
                      : "Confirmar nova senha"}
                  </Text>
                  <View style={s.field}>
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={21}
                      color={t.ink}
                    />
                    <TextInput
                      accessibilityLabel={
                        field === "password"
                          ? "Nova senha"
                          : "Confirmar nova senha"
                      }
                      value={values[field]}
                      onChangeText={(value) => {
                        setValues({ ...values, [field]: value });
                        setError("");
                      }}
                      editable={!busy}
                      secureTextEntry={!visible[field]}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      placeholder={
                        field === "password"
                          ? "Digite sua nova senha"
                          : "Repita sua nova senha"
                      }
                      placeholderTextColor={t.muted}
                      style={s.input}
                      returnKeyType={field === "confirmation" ? "done" : "next"}
                      onSubmitEditing={
                        field === "confirmation" ? submit : undefined
                      }
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      accessibilityLabel={`${visible[field] ? "Ocultar" : "Mostrar"} ${field === "password" ? "nova senha" : "confirmação de senha"}`}
                      accessibilityState={{ selected: visible[field] }}
                      onPress={() =>
                        setVisible({ ...visible, [field]: !visible[field] })
                      }
                      style={s.eye}
                    >
                      <MaterialCommunityIcons
                        name={
                          visible[field] ? "eye-off-outline" : "eye-outline"
                        }
                        size={21}
                        color={t.ink}
                      />
                    </Pressable>
                  </View>
                  {field === "password" && (
                    <Text style={s.help}>
                      Use uma senha forte e exclusiva, com pelo menos 8
                      caracteres.
                    </Text>
                  )}
                </View>
              ))}
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
                  {busy ? "Salvando…" : "Salvar nova senha"}
                </Text>
              </Pressable>
            </>
          )}
          {(complete || status !== "ready") && error ? (
            <Text accessibilityLiveRegion="polite" style={s.error}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/entrar")}
            style={complete ? s.primary : s.back}
          >
            <Text style={complete ? s.primaryText : s.link}>
              {complete ? "Ir para entrar" : "Voltar para entrar"}
            </Text>
          </Pressable>
          {complete && error ? (
            <Pressable
              accessibilityRole="button"
              style={s.back}
              disabled={busy}
              onPress={() => void signOut()}
            >
              <Text style={s.link}>Encerrar sessão</Text>
            </Pressable>
          ) : null}
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
  label: {
    fontFamily: t.sans,
    fontSize: 12,
    color: t.ink,
    marginBottom: 8,
    marginTop: 16,
  },
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
  eye: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
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
  back: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  link: {
    fontFamily: t.sans,
    fontSize: 12,
    color: "#35502a",
    textDecorationLine: "underline",
  },
  success: { alignSelf: "center", marginTop: 18 },
});
