import { useRef, useState, type ComponentRef } from "react";
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
import {
  createCollaborationRepository,
  collaborationMessage,
} from "@inout/finance/collaboration";
import { getAuthClient } from "../auth/composition";
import { theme as t } from "../theme";

export function InvitationScreen() {
  const [step, setStep] = useState<"code" | "review">("code");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  async function accept() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      const repository = createCollaborationRepository({
        baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
        getToken: async () => {
          const { data } = await getAuthClient().auth.getSession();
          return data.session?.access_token ?? null;
        },
      });
      const home = await repository.accept(code);
      router.replace({
        pathname: "/residencia",
        params: { household: home.id },
      });
    } catch (error) {
      setNotice(collaborationMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function back() {
    if (step === "review") {
      setStep("code");
      setNotice("");
      scroll.current?.scrollTo({ y: 0, animated: false });
    } else router.replace("/comecar");
  }
  function verify() {
    if (!/^[a-fA-F0-9]{48}$/.test(code.trim())) {
      setNotice(
        "Cole o código completo de 48 caracteres enviado pelo responsável.",
      );
      return;
    }
    setNotice("");
    setStep("review");
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.brand}>
            <MaterialCommunityIcons name="sprout" size={30} color={t.green} />
            <Text style={s.brandText}>ninho</Text>
          </View>
          <Pressable accessibilityRole="button" style={s.back} onPress={back}>
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
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={s.title}
          >
            {step === "code" ? "Entrar por convite" : "Este é o seu convite"}
          </Text>
          <Text style={s.subtitle}>
            {step === "code"
              ? "Informe o código que você recebeu para encontrar sua residência."
              : "Confira o acesso que será concedido. A validade será verificada ao confirmar."}
          </Text>
          {step === "code" ? (
            <>
              <Text style={s.label}>Código do convite</Text>
              <TextInput
                ref={input}
                accessibilityLabel="Código do convite"
                value={code}
                onChangeText={(value) => {
                  setCode(value);
                  setNotice("");
                }}
                placeholder="Cole o código do convite"
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
                <Text style={s.primaryText}>Revisar participação</Text>
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
                      value: "Residência vinculada ao código",
                    },
                    {
                      icon: "account-outline",
                      label: "Convite de",
                      value: "Responsável que compartilhou o código",
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
                disabled={busy}
                onPress={accept}
              >
                <Text style={s.primaryText}>
                  {busy ? "Confirmando…" : "Confirmar participação"}
                </Text>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    padding: 18,
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
  art: { width: "100%", aspectRatio: 2.5, marginBottom: 8 },
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
