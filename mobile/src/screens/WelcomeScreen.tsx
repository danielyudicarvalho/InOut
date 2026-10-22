import { useState } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../theme";
const features = [
  {
    title: "Entradas",
    description: "O que você recebe",
    detail:
      "Acompanhe o dinheiro que chega à sua residência, como salários e outras receitas.",
    icon: "sprout" as const,
    background: "#d6e3bc",
    color: "#507b32",
  },
  {
    title: "Saídas",
    description: "Para onde seu dinheiro vai",
    detail:
      "Organize as despesas do dia a dia por categoria e entenda seus gastos com tranquilidade.",
    icon: "arrow-down-thick" as const,
    background: "#ffc7a2",
    color: "#9b3e1b",
  },
  {
    title: "Transferências",
    description: "Entre suas contas",
    detail:
      "Movimente dinheiro entre suas contas financeiras sem confundir transferências com receitas ou despesas.",
    icon: "swap-horizontal" as const,
    background: "#f9d98c",
    color: "#875024",
  },
  {
    title: "Juntos ou só você",
    description: "Compartilhe se quiser",
    detail:
      "Cuide da sua residência sozinho ou convide alguém para organizar as finanças com você.",
    icon: "account-group" as const,
    background: "#d2d9b8",
    color: "#66513a",
  },
];
export function WelcomeScreen({ fontsReady }: { fontsReady: boolean }) {
  const [content, setContent] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const serif = {
    fontFamily: fontsReady
      ? t.serif
      : Platform.OS === "ios"
        ? "Georgia"
        : "serif",
  };
  const sans = { fontFamily: fontsReady ? t.sans : undefined };
  const next = (register: boolean) => {
    if (!register) {
      router.push("/entrar");
      return;
    }
    setContent({
      title: register
        ? "Vamos preparar seu ninho?"
        : "Que bom ter você de volta!",
      description: register
        ? "O próximo passo será criar seu usuário e depois criar uma residência ou participar por convite. Essa tela será construída na próxima etapa."
        : "A tela de entrar com e-mail e senha será construída na próxima etapa. Seu ninho está esperando por você.",
    });
  };
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={s.brand}>
            <MaterialCommunityIcons name="sprout" color={t.green} size={32} />
            <Text style={[s.brandText, serif]}>ninho</Text>
            <Text style={[s.by, sans]}>por InOut</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => next(false)}
            hitSlop={8}
            style={s.skip}
          >
            <Text style={[s.skipText, sans]}>Pular</Text>
          </Pressable>
        </View>
        <Image
          source={require("../../assets/pipo-home.webp")}
          style={s.art}
          resizeMode="cover"
          accessibilityLabel="Pipo, um passarinho amarelo em seu ninho, junto a uma casinha entre plantas"
        />
        <Text accessibilityRole="header" style={[s.title, serif]}>
          Seu dinheiro{"\n"}encontra um lar.
        </Text>
        <Text style={[s.subtitle, sans]}>
          Organize suas finanças com calma,{"\n"}do seu jeito.
        </Text>
        <View style={s.features}>
          {features.map((f) => (
            <Pressable
              key={f.title}
              accessibilityRole="button"
              accessibilityLabel={`${f.title}. ${f.description}. Saiba mais`}
              onPress={() =>
                setContent({ title: f.title, description: f.detail })
              }
              style={({ pressed }) => [s.feature, pressed && s.pressed]}
            >
              <View style={[s.icon, { backgroundColor: f.background }]}>
                <MaterialCommunityIcons
                  name={f.icon}
                  color={f.color}
                  size={28}
                />
              </View>
              <View style={s.featureCopy}>
                <Text style={[s.featureTitle, serif]}>{f.title}</Text>
                <Text style={[s.featureDescription, sans]}>
                  {f.description}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                color={t.muted}
                size={20}
              />
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => next(true)}
          style={({ pressed }) => [s.primary, pressed && s.pressed]}
        >
          <Text style={[s.primaryText, sans]}>Vamos começar</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={23}
            color="white"
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => next(false)}
          style={s.login}
        >
          <Text style={[s.loginText, sans]}>Já tenho conta</Text>
        </Pressable>
      </ScrollView>
      <Modal
        visible={content !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setContent(null)}
      >
        <View style={s.backdrop}>
          <View style={s.modal} accessibilityViewIsModal>
            <MaterialCommunityIcons name="sprout" size={36} color={t.green} />
            <Text accessibilityRole="header" style={[s.modalTitle, serif]}>
              {content?.title}
            </Text>
            <Text style={[s.modalText, sans]}>{content?.description}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setContent(null)}
              style={s.primary}
            >
              <Text style={[s.primaryText, sans]}>Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.cream },
  container: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 16,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandText: { fontSize: 29, color: t.ink },
  by: { fontSize: 9, color: t.muted, alignSelf: "flex-end", marginBottom: 8 },
  skip: {
    minHeight: 44,
    minWidth: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  skipText: { fontSize: 14, color: t.ink },
  art: {
    width: "100%",
    height: 215,
    borderRadius: 24,
    marginTop: 6,
    marginBottom: 12,
  },
  title: { fontSize: 34, lineHeight: 38, letterSpacing: -1.1, color: t.ink },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: t.muted,
    marginTop: 10,
    marginBottom: 16,
  },
  features: { gap: 8 },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 65,
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: "#fffcf4",
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCopy: { flex: 1 },
  featureTitle: { fontSize: 14, color: t.ink },
  featureDescription: {
    fontSize: 11,
    color: t.muted,
    lineHeight: 17,
    marginTop: 3,
  },
  primary: {
    backgroundColor: t.green,
    borderRadius: 14,
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryText: { fontSize: 16, color: "white" },
  login: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  loginText: {
    fontSize: 12,
    color: "#3f5932",
    textDecorationLine: "underline",
  },
  pressed: { opacity: 0.75 },
  backdrop: {
    flex: 1,
    backgroundColor: "#32291e99",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: t.cream,
    padding: 28,
    borderRadius: 24,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  modalTitle: {
    fontSize: 25,
    lineHeight: 31,
    color: t.ink,
    marginTop: 18,
    marginBottom: 12,
  },
  modalText: { fontSize: 15, lineHeight: 24, color: t.muted },
});
