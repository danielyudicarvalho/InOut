import { BrandLogo } from "../components/BrandLogo";
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
import { authMessage } from "@inout/identity";
import { getAuth } from "../auth/composition";
import { theme as t } from "../theme";

const choices = [
  {
    id: "create",
    title: "Criar uma residência",
    description:
      "Organize suas finanças em um espaço seu. Você pode usar sozinho ou convidar outras pessoas depois.",
    action: "Criar residência",
    image: require("../../assets/choice-create.webp"),
  },
  {
    id: "invite",
    title: "Participar por convite",
    description:
      "Recebeu um convite? Entre na residência de quem vai compartilhar as finanças com você.",
    action: "Usar convite",
    image: require("../../assets/choice-invite.webp"),
  },
] as const;
export function HouseholdChoiceScreen() {
  const [exitBusy, setExitBusy] = useState(false);
  const [exitNotice, setExitNotice] = useState("");
  async function signOut() {
    if (exitBusy) return;
    setExitNotice("");
    setExitBusy(true);
    try {
      await getAuth().signOut();
      router.replace("/entrar");
    } catch (error) {
      setExitNotice(authMessage(error));
    } finally {
      setExitBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar ao início"
            onPress={() => router.replace("/")}
            style={s.brand}
          >
            <BrandLogo />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={exitBusy}
            accessibilityState={{ disabled: exitBusy, busy: exitBusy }}
            onPress={() => void signOut()}
            style={s.exit}
          >
            <Text style={s.exitText}>{exitBusy ? "Saindo…" : "Sair"}</Text>
            <MaterialCommunityIcons name="logout" size={21} color={t.green} />
          </Pressable>
        </View>
        {exitNotice ? (
          <Text accessibilityLiveRegion="polite" style={s.subtitle}>
            {exitNotice}
          </Text>
        ) : null}
        <Image
          source={require("../../assets/choice-hero.webp")}
          style={s.hero}
          resizeMode="contain"
          accessibilityLabel="Pipo em seu ninho entre duas casinhas, flores e folhas"
        />
        <Text accessibilityRole="header" style={s.title}>
          Como você quer começar?
        </Text>
        <Text style={s.subtitle}>
          Crie seu espaço para cuidar das finanças ou entre em uma residência
          por convite.
        </Text>
        {choices.map((choice) => (
          <View key={choice.id} style={s.card}>
            <View style={[s.cardBody, choice.id === "invite" && s.inviteBody]}>
              <Image
                source={choice.image}
                style={[s.cardArt, choice.id === "invite" && s.inviteArt]}
                resizeMode="contain"
                accessible={false}
              />
              <View style={s.cardCopy}>
                <Text
                  accessibilityRole="header"
                  style={[s.cardTitle, choice.id === "invite" && s.inviteTitle]}
                >
                  {choice.title}
                </Text>
                <Text
                  style={[
                    s.description,
                    choice.id === "invite" && s.inviteDescription,
                  ]}
                >
                  {choice.description}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                choice.id === "create"
                  ? router.push("/criar-residencia")
                  : router.push("/entrar-convite")
              }
              style={({ pressed }) => [
                s.button,
                choice.id === "create" ? s.primary : s.secondary,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text
                style={choice.id === "create" ? s.primaryText : s.secondaryText}
              >
                {choice.action}
              </Text>
            </Pressable>
          </View>
        ))}
        <View style={s.footer}>
          <MaterialCommunityIcons name="sprout" size={25} color={t.green} />
          <Text style={s.footerText}>
            Residência é o espaço das suas finanças no Ninho.
          </Text>
        </View>
      </ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  brandText: { fontFamily: t.serif, fontSize: 28, color: t.ink },
  exit: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  exitText: { fontFamily: t.sans, fontSize: 13, color: t.green },
  hero: { width: "100%", aspectRatio: 2.5, marginVertical: 12 },
  cardBody: { width: "100%", alignItems: "center" },
  cardCopy: { flexShrink: 1 },
  inviteBody: { flexDirection: "row", gap: 8, marginBottom: 12 },
  inviteArt: { width: "30%", height: 90 },
  inviteTitle: {
    fontSize: 20,
    lineHeight: 25,
    textAlign: "left",
    marginTop: 0,
    marginBottom: 5,
  },
  inviteDescription: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "left",
    marginBottom: 0,
  },
  cardArt: { width: "100%", height: 108 },
  title: {
    fontFamily: t.serif,
    fontSize: 26,
    lineHeight: 32,
    color: t.ink,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 15,
    lineHeight: 22,
    color: t.ink,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 16,
    backgroundColor: "#fffcf4",
    alignItems: "center",
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: t.serif,
    fontSize: 25,
    lineHeight: 31,
    color: t.ink,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  description: {
    fontFamily: t.sans,
    fontSize: 14,
    lineHeight: 21,
    color: t.ink,
    textAlign: "center",
    marginBottom: 18,
  },
  button: {
    width: "100%",
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primary: { backgroundColor: t.green },
  secondary: { borderWidth: 1, borderColor: t.green },
  primaryText: { fontFamily: t.sans, fontSize: 15, color: "white" },
  secondaryText: { fontFamily: t.sans, fontSize: 15, color: "#35502a" },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  footerText: {
    fontFamily: t.sans,
    fontSize: 11,
    lineHeight: 17,
    color: t.ink,
    flex: 1,
  },
});
