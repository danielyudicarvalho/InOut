import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../theme";

const choices = [
  {
    id: "create",
    title: "Criar uma residência",
    description:
      "Organize suas finanças em um espaço seu. Você pode usar sozinho ou convidar outras pessoas depois.",
    action: "Criar residência",
    icon: "home-outline",
    detail:
      "Na próxima etapa você poderá informar o nome e as configurações iniciais da sua residência. Esse fluxo ainda não está disponível nesta prévia.",
  },
  {
    id: "invite",
    title: "Participar por convite",
    description:
      "Recebeu um convite? Entre na residência de quem vai compartilhar as finanças com você.",
    action: "Usar convite",
    icon: "email-open-outline",
    detail:
      "Na próxima etapa você poderá informar o código do convite, conferir a residência e confirmar sua participação. Esse fluxo ainda não está disponível nesta prévia.",
  },
] as const;
export function HouseholdChoiceScreen() {
  const [selected, setSelected] = useState<(typeof choices)[number] | null>(
    null,
  );
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
            <MaterialCommunityIcons name="sprout" size={29} color={t.green} />
            <Text style={s.brandText}>ninho</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/entrar")}
            style={s.exit}
          >
            <Text style={s.exitText}>Sair</Text>
            <MaterialCommunityIcons name="logout" size={21} color={t.green} />
          </Pressable>
        </View>
        <Image
          source={require("../../assets/pipo-home.webp")}
          style={s.hero}
          resizeMode="cover"
          accessibilityLabel="Pipo em seu ninho ao lado de uma casinha entre plantas"
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
            <MaterialCommunityIcons
              name={choice.icon}
              size={64}
              color={t.green}
            />
            <Text accessibilityRole="header" style={s.cardTitle}>
              {choice.title}
            </Text>
            <Text style={s.description}>{choice.description}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                choice.id === "create"
                  ? router.push("/criar-residencia")
                  : setSelected(choice)
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
        <Text style={s.preview}>
          Prévia de interface. Criar residência e usar convite ainda não estão
          integrados. Sair retorna à tela de entrada.
        </Text>
      </ScrollView>
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.backdrop}>
          <View style={s.modal} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={s.cardTitle}>
              {selected?.title}
            </Text>
            <Text style={s.description}>{selected?.detail}</Text>
            <Pressable
              accessibilityRole="button"
              style={[s.button, s.primary]}
              onPress={() => setSelected(null)}
            >
              <Text style={s.primaryText}>Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  brandText: { fontFamily: t.serif, fontSize: 28, color: t.ink },
  exit: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  exitText: { fontFamily: t.sans, fontSize: 13, color: t.green },
  hero: { width: "100%", height: 170, borderRadius: 20, marginVertical: 16 },
  title: {
    fontFamily: t.serif,
    fontSize: 28,
    lineHeight: 33,
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
    padding: 20,
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
  preview: {
    fontFamily: t.sans,
    fontSize: 10,
    lineHeight: 16,
    color: t.muted,
    textAlign: "center",
    marginTop: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#32291e99",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: t.cream,
    padding: 26,
    borderRadius: 22,
  },
});
