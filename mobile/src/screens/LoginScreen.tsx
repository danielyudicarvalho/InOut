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
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function submit() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      await getAuth().signIn({ email, password });
      rememberEmail(email);
      setPassword("");
      router.replace("/comecar");
    } catch (error) {
      rememberEmail(email);
      setNotice(authMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

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
            onPress={() => router.back()}
            style={s.brand}
          >
            <MaterialCommunityIcons name="sprout" size={30} color={t.green} />
            <Text style={s.brandText}>ninho</Text>
          </Pressable>
          <Image
            source={require("../../assets/pipo-home.webp")}
            style={s.art}
            resizeMode="cover"
            accessibilityLabel="Pipo em seu ninho entre plantas"
          />
          <Text style={s.title} accessibilityRole="header">
            Bom ter{"\n"}você de volta.
          </Text>
          <Text style={s.subtitle}>Entre no seu Ninho.</Text>
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
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              placeholder="voce@exemplo.com"
              placeholderTextColor={t.muted}
              style={s.input}
            />
          </View>
          <Text style={s.label}>Senha</Text>
          <View style={s.field}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={21}
              color={t.ink}
            />
            <TextInput
              accessibilityLabel="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              style={s.input}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? "Ocultar senha" : "Mostrar senha"}
              accessibilityState={{ selected: visible }}
              onPress={() => setVisible(!visible)}
              style={s.eye}
            >
              <MaterialCommunityIcons
                name={visible ? "eye-off-outline" : "eye-outline"}
                size={21}
                color={t.ink}
              />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/esqueci-senha")}
            style={s.forgot}
          >
            <Text style={s.link}>Esqueci minha senha</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={submit}
            disabled={busy}
            accessibilityState={{ disabled: busy, busy }}
            style={({ pressed }) => [s.submit, pressed && { opacity: 0.75 }]}
          >
            <Text style={s.submitText}>{busy ? "Entrando…" : "Entrar"}</Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color="white"
            />
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
          <Pressable
            accessibilityRole="button"
            style={s.register}
            onPress={() => router.push("/confirmar-email")}
          >
            <Text style={s.link}>Confirmar meu e-mail</Text>
          </Pressable>
          <View style={s.divider}>
            <View style={s.line} />
            <Text style={s.caption}>Ainda não tem conta?</Text>
            <View style={s.line} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/criar-conta")}
            style={s.register}
          >
            <Text style={s.link}>Criar conta</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  content: {
    padding: 24,
    paddingTop: 12,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  brand: { flexDirection: "row", gap: 6, alignItems: "center", minHeight: 44 },
  brandText: { fontFamily: t.serif, fontSize: 26, color: t.ink },
  art: {
    width: "100%",
    height: 200,
    borderRadius: 18,
    marginTop: 8,
    marginBottom: 18,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 34,
    lineHeight: 38,
    color: t.ink,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 16,
    color: t.ink,
    marginTop: 8,
    marginBottom: 16,
  },
  label: {
    fontFamily: t.sans,
    color: t.ink,
    fontSize: 13,
    marginTop: 16,
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
    minHeight: 50,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: t.ink,
    fontFamily: t.sans,
    fontSize: 14,
    paddingVertical: 12,
  },
  eye: {
    minWidth: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  forgot: {
    alignSelf: "flex-end",
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 12,
  },
  link: {
    fontFamily: t.sans,
    fontSize: 13,
    color: "#30473c",
    textDecorationLine: "underline",
  },
  submit: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: t.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  submitText: { fontFamily: t.sans, color: "white", fontSize: 16 },
  notice: {
    fontFamily: t.sans,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    marginTop: 14,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 26,
  },
  line: { height: 1, backgroundColor: t.line, flex: 1 },
  caption: { fontFamily: t.sans, color: t.muted, fontSize: 12 },
  register: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
