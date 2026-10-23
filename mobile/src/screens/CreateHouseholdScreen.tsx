import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { theme as t } from "../theme";

const options = {
  currency: [
    { value: "BRL", label: "Real brasileiro (BRL)" },
    { value: "USD", label: "Dólar americano (USD)" },
    { value: "EUR", label: "Euro (EUR)" },
  ],
  timezone: [
    { value: "America/Cuiaba", label: "Cuiabá (UTC−04:00)" },
    { value: "America/Sao_Paulo", label: "São Paulo (UTC−03:00)" },
    { value: "America/Manaus", label: "Manaus (UTC−04:00)" },
    { value: "America/Rio_Branco", label: "Rio Branco (UTC−05:00)" },
    { value: "America/Noronha", label: "Fernando de Noronha (UTC−02:00)" },
  ],
};
export function CreateHouseholdScreen() {
  const [name, setName] = useState("Meu Ninho");
  const [settings, setSettings] = useState({
    currency: "BRL",
    timezone: "America/Cuiaba",
  });
  const [picker, setPicker] = useState<"currency" | "timezone" | null>(null);
  const [notice, setNotice] = useState("");
  function submit() {
    setNotice(
      name.trim()
        ? "Configurações conferidas. A criação da residência ainda não está integrada; nenhum dado foi salvo."
        : "Informe o nome da residência.",
    );
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
          <View style={s.header}>
            <View style={s.brand}>
              <MaterialCommunityIcons name="sprout" size={29} color={t.green} />
              <Text style={s.brandText}>ninho</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/entrar")}
              style={s.linkTarget}
            >
              <Text style={s.link}>Sair</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/comecar")}
            style={s.back}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={20}
              color={t.green}
            />
            <Text style={s.link}>Voltar</Text>
          </Pressable>
          <Image
            source={require("../../assets/pipo-create-residence-mobile.webp")}
            style={s.art}
            resizeMode="contain"
            accessibilityLabel="Pipo ao lado de uma casinha de telhado verde, cercados por flores e folhas"
          />
          <Text accessibilityRole="header" style={s.title}>
            Criar residência
          </Text>
          <Text style={s.subtitle}>
            Dê um nome ao seu espaço e confira as configurações iniciais.
          </Text>
          <Text style={s.label}>Nome da residência</Text>
          <View style={s.field}>
            <MaterialCommunityIcons
              name="home-outline"
              size={22}
              color={t.muted}
            />
            <TextInput
              accessibilityLabel="Nome da residência"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setNotice("");
              }}
              maxLength={100}
              style={s.input}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          </View>
          <Text style={s.help}>
            Pode ser o nome da sua casa, família ou algo só seu.
          </Text>
          {(["currency", "timezone"] as const).map((field) => (
            <View key={field}>
              <Text style={s.label}>
                {field === "currency" ? "Moeda de referência" : "Fuso horário"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${field === "currency" ? "Moeda de referência" : "Fuso horário"}: ${options[field].find((item) => item.value === settings[field])?.label}`}
                accessibilityState={{ expanded: picker === field }}
                onPress={() => setPicker(field)}
                style={s.field}
              >
                <MaterialCommunityIcons
                  name={
                    field === "currency" ? "database-outline" : "clock-outline"
                  }
                  size={22}
                  color={t.muted}
                />
                <Text style={s.optionLabel}>
                  {
                    options[field].find(
                      (item) => item.value === settings[field],
                    )?.label
                  }
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={t.ink}
                />
              </Pressable>
              <Text style={s.help}>
                {field === "currency"
                  ? "Usada nos resumos da residência."
                  : "Define as datas e os períodos dos relatórios."}
              </Text>
            </View>
          ))}
          <View style={s.info}>
            <MaterialCommunityIcons name="sprout" size={30} color={t.green} />
            <Text style={s.infoText}>
              Você pode começar sozinho e convidar pessoas depois.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={s.primary}
            onPress={submit}
          >
            <Text style={s.primaryText}>Criar residência</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={s.notice}>
            {notice}
          </Text>
          <Text style={s.preview}>
            Prévia de interface. Nenhuma residência é criada. Sair retorna à
            tela de entrada.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={s.backdrop}>
          <View style={s.modal} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={s.modalTitle}>
              {picker === "currency" ? "Moeda de referência" : "Fuso horário"}
            </Text>
            <ScrollView>
              {picker &&
                options[picker].map((option) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: settings[picker] === option.value,
                    }}
                    key={option.value}
                    style={s.pickerOption}
                    onPress={() => {
                      setSettings({ ...settings, [picker]: option.value });
                      setNotice("");
                      setPicker(null);
                    }}
                  >
                    <Text style={s.optionLabel}>{option.label}</Text>
                    {settings[picker] === option.value && (
                      <MaterialCommunityIcons
                        name="check"
                        size={22}
                        color={t.green}
                      />
                    )}
                  </Pressable>
                ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              style={s.linkTarget}
              onPress={() => setPicker(null)}
            >
              <Text style={s.link}>Cancelar</Text>
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
    paddingBottom: 30,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandText: { fontFamily: t.serif, fontSize: 28, color: t.ink },
  linkTarget: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  link: { fontFamily: t.sans, fontSize: 13, color: "#35502a" },
  back: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44 },
  art: { width: "100%", height: 170, borderRadius: 18, marginBottom: 16 },
  title: { fontFamily: t.serif, fontSize: 32, lineHeight: 37, color: t.ink },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 15,
    lineHeight: 22,
    color: t.ink,
    marginTop: 8,
    marginBottom: 10,
  },
  label: {
    fontFamily: t.serif,
    fontSize: 15,
    color: t.ink,
    marginTop: 20,
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 50,
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
    fontSize: 14,
    color: t.ink,
  },
  help: {
    fontFamily: t.sans,
    fontSize: 11,
    lineHeight: 17,
    color: t.muted,
    marginTop: 6,
  },
  optionLabel: {
    flex: 1,
    fontFamily: t.sans,
    fontSize: 14,
    color: t.ink,
    lineHeight: 21,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#edf3e1",
    borderRadius: 10,
    marginVertical: 20,
  },
  infoText: {
    fontFamily: t.sans,
    fontSize: 12,
    lineHeight: 18,
    color: t.ink,
    flex: 1,
  },
  primary: {
    minHeight: 48,
    backgroundColor: t.green,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: t.sans, fontSize: 16, color: "white" },
  notice: {
    fontFamily: t.sans,
    fontSize: 13,
    lineHeight: 20,
    color: t.muted,
    marginTop: 12,
  },
  preview: {
    fontFamily: t.sans,
    fontSize: 10,
    lineHeight: 16,
    color: t.muted,
    marginTop: 12,
    textAlign: "center",
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#32291e99",
  },
  modal: {
    backgroundColor: t.cream,
    padding: 24,
    borderRadius: 20,
    width: "100%",
    maxWidth: 480,
    maxHeight: "80%",
    alignSelf: "center",
  },
  modalTitle: {
    fontFamily: t.serif,
    fontSize: 23,
    color: t.ink,
    marginBottom: 18,
  },
  pickerOption: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
});
