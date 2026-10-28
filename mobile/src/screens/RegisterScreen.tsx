import { useRef, useState } from "react";
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
import { authMessage } from "@inout/identity";
import { getAuth, rememberEmail } from "../auth/composition";
import { theme as t } from "../theme";

export function RegisterScreen() {
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmation: "",
  });
  const [visible, setVisible] = useState({
    password: false,
    confirmation: false,
  });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function submit() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = await getAuth().signUp(values);
      rememberEmail(values.email);
      setValues({ ...values, password: "", confirmation: "" });
      router.replace(result === "signedIn" ? "/comecar" : "/confirmar-email");
    } catch (error) {
      setNotice(authMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const fields = [
    {
      key: "name",
      label: "Nome",
      placeholder: "Como podemos chamar você?",
      icon: "account-outline",
    },
    {
      key: "email",
      label: "E-mail",
      placeholder: "voce@exemplo.com",
      icon: "email-outline",
    },
    {
      key: "password",
      label: "Senha",
      placeholder: "Crie uma senha",
      icon: "lock-outline",
    },
    {
      key: "confirmation",
      label: "Confirmar senha",
      placeholder: "Repita sua senha",
      icon: "lock-outline",
    },
  ] as const;
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar ao início"
            onPress={() => router.replace("/")}
            style={s.brand}
          >
            <MaterialCommunityIcons name="sprout" size={28} color={t.green} />
            <Text style={s.brandText}>ninho</Text>
          </Pressable>
          <Image
            source={require("../../assets/pipo-home.webp")}
            style={s.art}
            resizeMode="cover"
            accessibilityLabel="Pipo entre plantas em seu ninho"
          />
          <Text accessibilityRole="header" style={s.title}>
            Crie seu acesso{"\n"}ao Ninho.
          </Text>
          <Text style={s.subtitle}>Vamos cuidar do seu dinheiro?</Text>
          {fields.map(({ key, label, placeholder, icon }) => {
            const secret = key === "password" || key === "confirmation";
            return (
              <View key={key}>
                <Text style={s.label}>{label}</Text>
                <View style={s.field}>
                  <MaterialCommunityIcons name={icon} size={20} color={t.ink} />
                  <TextInput
                    accessibilityLabel={label}
                    placeholder={placeholder}
                    placeholderTextColor={t.muted}
                    value={values[key]}
                    onChangeText={(value) => {
                      setValues({ ...values, [key]: value });
                      setNotice("");
                    }}
                    style={s.input}
                    autoCapitalize={key === "name" ? "words" : "none"}
                    autoCorrect={false}
                    keyboardType={key === "email" ? "email-address" : "default"}
                    autoComplete={
                      key === "name"
                        ? "name"
                        : key === "email"
                          ? "email"
                          : "new-password"
                    }
                    secureTextEntry={secret && !visible[key]}
                    maxLength={key === "name" ? 100 : undefined}
                    returnKeyType={key === "confirmation" ? "go" : "next"}
                    onSubmitEditing={
                      key === "confirmation" ? submit : undefined
                    }
                  />
                  {secret && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${visible[key] ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`}
                      onPress={() =>
                        setVisible({ ...visible, [key]: !visible[key] })
                      }
                      style={s.eye}
                    >
                      <MaterialCommunityIcons
                        name={visible[key] ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={t.ink}
                      />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
          <Text style={s.help}>
            Use uma senha forte e exclusiva, com pelo menos 8 caracteres.
          </Text>
          <View style={s.info}>
            <MaterialCommunityIcons
              name="wallet-outline"
              size={28}
              color="#80532e"
            />
            <View style={s.infoCopy}>
              <Text style={s.infoTitle}>Este é seu cadastro de usuário.</Text>
              <Text style={s.help}>
                Suas contas financeiras serão adicionadas depois.
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [s.submit, pressed && { opacity: 0.75 }]}
            onPress={submit}
            disabled={busy}
            accessibilityState={{ disabled: busy, busy }}
          >
            <Text style={s.submitText}>
              {busy ? "Criando acesso…" : "Criar meu acesso"}
            </Text>
          </Pressable>
          {notice ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={s.notice}
            >
              {notice}
            </Text>
          ) : null}
          <View style={s.login}>
            <Text style={s.help}>Já tem cadastro?</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/entrar")}
              style={s.linkTarget}
            >
              <Text style={s.link}>Entrar</Text>
            </Pressable>
          </View>
          <Text style={s.terms}>Ao continuar, você concorda com os</Text>
          <View style={s.legal}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setNotice(
                  "Os Termos de Uso ainda não estão disponíveis nesta prévia.",
                )
              }
              style={s.linkTarget}
            >
              <Text style={s.link}>Termos de Uso</Text>
            </Pressable>
            <Text style={s.help}>e a</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setNotice(
                  "A Política de Privacidade ainda não está disponível nesta prévia.",
                )
              }
              style={s.linkTarget}
            >
              <Text style={s.link}>Política de Privacidade</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: 22,
    paddingTop: 8,
    paddingBottom: 26,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  brandText: { fontFamily: t.serif, fontSize: 25, color: t.ink },
  art: { height: 130, width: "100%", borderRadius: 16, marginBottom: 12 },
  title: { fontFamily: t.serif, fontSize: 30, lineHeight: 33, color: t.ink },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 14,
    color: t.ink,
    marginTop: 8,
    marginBottom: 8,
  },
  label: {
    fontFamily: t.sans,
    fontSize: 12,
    color: t.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 9,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontFamily: t.sans,
    fontSize: 13,
    color: t.ink,
  },
  eye: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  help: {
    fontFamily: t.sans,
    fontSize: 10,
    color: t.muted,
    lineHeight: 16,
    marginTop: 5,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f7ecdc",
    borderRadius: 10,
    padding: 12,
    marginVertical: 14,
  },
  infoCopy: { flex: 1 },
  infoTitle: { fontFamily: t.serif, fontSize: 12, color: t.ink },
  submit: {
    minHeight: 48,
    backgroundColor: t.green,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { fontFamily: t.sans, fontSize: 15, color: "white" },
  notice: {
    fontFamily: t.sans,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    marginTop: 12,
  },
  login: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 10,
  },
  linkTarget: { minHeight: 44, justifyContent: "center" },
  link: {
    fontFamily: t.sans,
    fontSize: 11,
    color: "#30473c",
    textDecorationLine: "underline",
  },
  terms: {
    fontFamily: t.sans,
    fontSize: 10,
    color: t.muted,
    textAlign: "center",
    marginTop: 4,
  },
  legal: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
});
