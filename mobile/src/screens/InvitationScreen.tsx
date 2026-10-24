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
import { theme as t } from "../theme";

export function InvitationScreen() {
  const [step, setStep] = useState<"code" | "review">("code");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  function verify() {
    const demoCode = code.trim().toUpperCase();
    if (demoCode === "NINHO-EXPIRADO") {
      router.push("/convite-expirado");
      return;
    }
    if (demoCode === "NINHO-INVALIDO") {
      router.push("/convite-invalido");
      return;
    }
    if (demoCode === "NINHO-USADO") {
      router.push("/convite-utilizado");
      return;
    }
    if (code.trim().toUpperCase() !== "NINHO-7K2M") {
      setNotice(
        "Nesta prévia, use o código de demonstração NINHO-7K2M. Nenhum convite real foi consultado.",
      );
      return;
    }
    setNotice("");
    setStep("review");
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
          <View style={s.brand}>
            <MaterialCommunityIcons name="sprout" size={30} color={t.green} />
            <Text style={s.brandText}>ninho</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={s.back}
            onPress={() => {
              if (step === "review") {
                setStep("code");
                setNotice("");
              } else router.replace("/comecar");
            }}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={20}
              color={t.green}
            />
            <Text style={s.link}>Voltar</Text>
          </Pressable>
          <Image
            source={
              step === "code"
                ? require("../../assets/pipo-invite-code-mobile.webp")
                : require("../../assets/pipo-invite-review-mobile.webp")
            }
            style={s.art}
            resizeMode="contain"
            accessibilityLabel={
              step === "code"
                ? "Pipo segurando um envelope de convite"
                : "Pipo dando boas-vindas ao lado de uma casa de telhado verde"
            }
          />
          <Text accessibilityRole="header" style={s.title}>
            {step === "code" ? "Entrar por convite" : "Este é o seu convite"}
          </Text>
          <Text style={s.subtitle}>
            {step === "code"
              ? "Informe o código que você recebeu para encontrar sua residência."
              : "Revise as informações abaixo antes de confirmar sua participação."}
          </Text>
          {step === "code" ? (
            <>
              <Text style={s.label}>Código do convite</Text>
              <TextInput
                accessibilityLabel="Código do convite"
                value={code}
                onChangeText={(value) => {
                  setCode(value);
                  setNotice("");
                }}
                placeholder="NINHO-7K2M"
                placeholderTextColor={t.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                maxLength={64}
                style={s.input}
                returnKeyType="go"
                onSubmitEditing={verify}
              />
              <Text style={s.help}>
                Cole ou digite o código enviado por quem convidou você.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={s.primary}
                onPress={verify}
              >
                <Text style={s.primaryText}>Verificar convite</Text>
              </Pressable>
              <View style={s.info}>
                <MaterialCommunityIcons
                  name="shield-check"
                  size={25}
                  color={t.muted}
                />
                <Text style={s.infoText}>
                  Você poderá revisar o convite antes de participar.
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={s.details}>
                {(
                  [
                    {
                      icon: "home-outline",
                      label: "Residência",
                      value: "Ninho da Família",
                    },
                    {
                      icon: "account-outline",
                      label: "Convite de",
                      value: "Ana",
                    },
                  ] as const
                ).map((item) => (
                  <View key={item.label} style={s.detail}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={30}
                      color={t.muted}
                    />
                    <View style={s.detailCopy}>
                      <Text style={s.detailLabel}>{item.label}</Text>
                      <Text style={s.detailValue}>{item.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={s.help}>
                Ao aceitar, você passará a participar desta residência.
              </Text>
              <View style={s.info}>
                <MaterialCommunityIcons
                  name="shield-check"
                  size={25}
                  color={t.muted}
                />
                <Text style={s.infoText}>
                  Os dados financeiros só ficam disponíveis após a confirmação
                  da sua participação.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={s.primary}
                onPress={() => router.push("/convite-aceito")}
              >
                <Text style={s.primaryText}>Confirmar participação</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.cancel}
                onPress={() => router.replace("/comecar")}
              >
                <Text style={s.link}>Agora não</Text>
              </Pressable>
            </>
          )}
          <Text accessibilityLiveRegion="polite" style={s.notice}>
            {notice}
          </Text>
          <Text style={s.preview}>
            Prévia com dados fictícios. Use NINHO-7K2M para revisar o exemplo.
            Outros estados: NINHO-EXPIRADO, NINHO-INVALIDO e NINHO-USADO. Nenhum
            convite é verificado ou aceito no servidor.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    padding: 22,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  brandText: { fontFamily: t.serif, fontSize: 28, color: t.ink },
  back: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7 },
  link: {
    fontFamily: t.sans,
    fontSize: 13,
    color: "#35502a",
    textDecorationLine: "underline",
  },
  art: { width: "100%", height: 180, marginBottom: 14 },
  title: { fontFamily: t.serif, fontSize: 31, lineHeight: 36, color: t.ink },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 15,
    lineHeight: 22,
    color: t.ink,
    marginTop: 8,
    marginBottom: 16,
  },
  label: {
    fontFamily: t.serif,
    fontSize: 15,
    color: t.ink,
    marginTop: 10,
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: t.sans,
    fontSize: 16,
    color: t.ink,
  },
  help: {
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: t.muted,
    marginTop: 8,
  },
  primary: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: t.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    paddingHorizontal: 10,
  },
  primaryText: { fontFamily: t.sans, fontSize: 15, color: "white" },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f6f0df",
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: t.ink,
  },
  details: {
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  detailCopy: { flex: 1 },
  detailLabel: {
    fontFamily: t.sans,
    fontSize: 12,
    color: t.muted,
    marginBottom: 4,
  },
  detailValue: { fontFamily: t.serif, fontSize: 19, color: t.ink },
  cancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  notice: {
    fontFamily: t.sans,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    marginTop: 14,
  },
  preview: {
    fontFamily: t.sans,
    fontSize: 10,
    lineHeight: 16,
    color: t.muted,
    marginTop: 12,
  },
});
