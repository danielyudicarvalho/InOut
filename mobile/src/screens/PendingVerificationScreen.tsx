import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { money, displayDate, type RecordKind, type RecordReview } from "@inout/finance";
import { useFinancialHome } from "../finance/use-financial-home";
import { theme as t } from "../theme";

export function PendingVerificationScreen({
  household = "",
  householdName = "",
  kind = "expense",
  summary = null,
  description = "",
  amount = 0,
  currency = "BRL",
  accountName = "",
  date = "",
  onRetry,
  submitting = false,
}: {
  household?: string;
  householdName?: string;
  kind?: RecordKind;
  summary?: RecordReview | null;
  description?: string;
  amount?: number | string;
  currency?: string;
  accountName?: string;
  date?: string;
  onRetry?: () => void;
  submitting?: boolean;
}) {
  const p = useLocalSearchParams();

  const qHousehold =
    (typeof p.household === "string" && p.household) || household;
  const qDate =
    (typeof p.date === "string" && p.date) ||
    date ||
    new Date().toISOString().slice(0, 10);
  const qPeriod =
    (typeof p.period === "string" && p.period) || qDate.slice(0, 7);
  const qDescription =
    (typeof p.description === "string" && p.description.trim()) || description;
  const qKind = ((typeof p.kind === "string" && p.kind) ||
    kind ||
    "expense") as RecordKind;
  const rawAmount = typeof p.amount === "string" ? p.amount : amount;
  const qAmount =
    typeof rawAmount === "string"
      ? Math.round((parseFloat(rawAmount.replace(",", ".")) || 0) * 100)
      : rawAmount;
  const qCurrency =
    (typeof p.currency === "string" && p.currency) || currency || "BRL";
  const qAccount =
    (typeof p.account === "string" && p.account.trim()) || accountName;

  const home = useFinancialHome({
    initialHouseholdId: qHousehold,
    initialPeriod: qPeriod,
  });

  const activeHouseholdName =
    householdName ||
    home.households.find((h) => h.id === (qHousehold || home.householdId))
      ?.name ||
    "Residência";

  const resolvedHousehold = qHousehold || home.householdId || "";

  const [checking, setChecking] = useState(false);

  const backToHistory = () => {
    router.replace({
      pathname: "/lancamentos",
      params: {
        ...(resolvedHousehold ? { household: resolvedHousehold } : {}),
        ...(qPeriod ? { period: qPeriod } : {}),
        currency: qCurrency,
      },
    });
  };

  const handleVerifyAgain = () => {
    if (onRetry) {
      onRetry();
    } else {
      setChecking(true);
      setTimeout(() => {
        setChecking(false);
        backToHistory();
      }, 1000);
    }
  };

  const isExpense = qKind === "expense";
  const isIncome = qKind === "income";
  const isTransfer = qKind === "transfer";

  const formattedAmount = money(Math.abs(qAmount), qCurrency);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar with Ninho Brand, Residence Pill & Notification */}
        <View style={s.topbar}>
          <View style={s.brandGroup}>
            <MaterialCommunityIcons
              name="leaf"
              size={20}
              color="#5e7e4d"
              accessible={false}
            />
            <Text style={s.brandText}>Ninho</Text>
          </View>

          <View style={s.residencePill}>
            <MaterialCommunityIcons
              name="home-variant"
              size={16}
              color="#486049"
              accessible={false}
            />
            <Text style={s.residenceText}>{activeHouseholdName}</Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={16}
              color="#486049"
              accessible={false}
            />
          </View>

          <View style={s.notificationBtn}>
            <MaterialCommunityIcons
              name="bell-outline"
              size={20}
              color="#3e503f"
              accessible={false}
            />
          </View>
        </View>

        {/* Hero Artwork */}
        <View style={s.artContainer}>
          <Image
            source={require("../../assets/pipo-verifying-record.webp")}
            style={s.art}
            resizeMode="contain"
            accessibilityLabel="Pipo verificando lançamento com caderno e ampulheta"
          />
        </View>

        {/* Title & Subtitle */}
        <Text accessibilityRole="header" style={s.title}>
          Estamos verificando seu lançamento
        </Text>
        <Text style={s.subtitle}>
          Ainda não foi possível confirmar o resultado. Ele pode já ter sido
          registrado.
        </Text>

        {/* Verification Card */}
        <View style={s.card}>
          {/* Card Header */}
          <View style={s.cardHeader}>
            <View style={s.cardIconCircle}>
              <MaterialCommunityIcons
                name={
                  isTransfer
                    ? "swap-horizontal"
                    : isIncome
                      ? "cash-plus"
                      : "cart-outline"
                }
                size={22}
                color="#2d4a30"
                accessible={false}
              />
            </View>
            <Text style={s.recordTitle} numberOfLines={1}>
              {qDescription.trim() ||
                (isTransfer
                  ? "Transferência"
                  : isIncome
                    ? "Entrada"
                    : "Saída")}
            </Text>
            <View style={s.badge}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color="#9a4811"
                accessible={false}
              />
              <Text style={s.badgeText}>Em verificação</Text>
            </View>
          </View>

          {/* Rows List */}
          <View style={s.rowsContainer}>
            {/* Tipo */}
            <View style={s.fieldRow}>
              <View style={s.fieldLabelGroup}>
                <MaterialCommunityIcons
                  name={isExpense ? "arrow-bottom-left" : "arrow-top-right"}
                  size={16}
                  color={isExpense ? "#b85b43" : "#2d7a3e"}
                  accessible={false}
                />
                <Text style={s.fieldLabel}>Tipo</Text>
              </View>
              <Text style={s.fieldValue}>
                {isExpense ? "Saída" : isIncome ? "Entrada" : "Transferência"}
              </Text>
            </View>

            {/* Valor */}
            <View style={s.fieldRow}>
              <View style={s.fieldLabelGroup}>
                <MaterialCommunityIcons
                  name="currency-usd"
                  size={16}
                  color="#637763"
                  accessible={false}
                />
                <Text style={s.fieldLabel}>Valor</Text>
              </View>
              <Text style={[s.fieldValue, s.amountValue]}>
                {formattedAmount}
              </Text>
            </View>

            {/* Conta */}
            <View style={s.fieldRow}>
              <View style={s.fieldLabelGroup}>
                <MaterialCommunityIcons
                  name="credit-card-outline"
                  size={16}
                  color="#637763"
                  accessible={false}
                />
                <Text style={s.fieldLabel}>Conta</Text>
              </View>
              <Text style={s.fieldValue}>{qAccount || "—"}</Text>
            </View>

            {/* Data */}
            <View style={[s.fieldRow, { borderBottomWidth: 0 }]}>
              <View style={s.fieldLabelGroup}>
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={16}
                  color="#637763"
                  accessible={false}
                />
                <Text style={s.fieldLabel}>Data</Text>
              </View>
              <Text style={s.fieldValue}>{displayDate(qDate)}</Text>
            </View>
          </View>

          {/* Card Warning Alert */}
          <View style={s.cardWarning}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={18}
              color="#d97706"
              accessible={false}
            />
            <Text style={s.warningText}>
              Para evitar duplicidade, não crie outro lançamento igual enquanto
              verificamos.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            style={[
              s.primaryBtn,
              (submitting || checking) && s.btnDisabled,
            ]}
            onPress={handleVerifyAgain}
            disabled={submitting || checking}
          >
            {submitting || checking ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialCommunityIcons
                name="reload"
                size={18}
                color="#ffffff"
                accessible={false}
              />
            )}
            <Text style={s.primaryBtnText}>
              {submitting || checking
                ? "Verificando…"
                : "Verificar novamente"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={s.secondaryBtn}
            onPress={backToHistory}
          >
            <MaterialCommunityIcons
              name="file-document-outline"
              size={18}
              color="#2d4a30"
              accessible={false}
            />
            <Text style={s.secondaryBtnText}>Ir ao histórico</Text>
          </Pressable>

          <Text style={s.actionsHelp}>
            Ao verificar novamente, consultamos esta mesma operação.
          </Text>
        </View>

        {/* Bottom Reassurance Banner */}
        <View style={s.bottomNotice}>
          <MaterialCommunityIcons
            name="sprout"
            size={18}
            color="#49654d"
            accessible={false}
          />
          <Text style={s.bottomNoticeText}>
            Você pode sair desta tela e conferir o resultado no histórico.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fcfaf5",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    alignItems: "center",
  },
  topbar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandText: {
    fontFamily: t.serif,
    fontSize: 18,
    fontWeight: "700",
    color: "#1e3020",
  },
  residencePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f3ede2",
    borderWidth: 1,
    borderColor: "#e7dcce",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  residenceText: {
    fontFamily: t.sans,
    fontSize: 13,
    fontWeight: "600",
    color: "#2b3a2b",
  },
  notificationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  artContainer: {
    width: "100%",
    alignItems: "center",
    marginVertical: 12,
  },
  art: {
    width: 250,
    height: 160,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 23,
    fontWeight: "700",
    color: "#1e3020",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 14,
    color: "#5e6f5f",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 24,
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#ebdccb",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#503214",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f2e9de",
    marginBottom: 10,
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e6efe5",
    alignItems: "center",
    justifyContent: "center",
  },
  recordTitle: {
    flex: 1,
    fontFamily: t.sans,
    fontSize: 15.5,
    fontWeight: "700",
    color: "#1e3020",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fde8cc",
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  badgeText: {
    fontFamily: t.sans,
    fontSize: 11.5,
    fontWeight: "600",
    color: "#9a4811",
  },
  rowsContainer: {
    marginBottom: 14,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f7f1e9",
  },
  fieldLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldLabel: {
    fontFamily: t.sans,
    fontSize: 13,
    color: "#788777",
  },
  fieldValue: {
    fontFamily: t.sans,
    fontSize: 14,
    fontWeight: "600",
    color: "#212f22",
  },
  amountValue: {
    fontWeight: "700",
    color: "#1e3020",
  },
  cardWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    padding: 10,
  },
  warningText: {
    flex: 1,
    fontFamily: t.sans,
    fontSize: 12,
    color: "#92400e",
    lineHeight: 16,
  },
  actions: {
    width: "100%",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: "#2d4a30",
    borderRadius: 25,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#2d4a30",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontFamily: t.sans,
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  secondaryBtn: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#2d4a30",
    borderRadius: 25,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: {
    fontFamily: t.sans,
    fontSize: 15,
    fontWeight: "700",
    color: "#2d4a30",
  },
  actionsHelp: {
    fontFamily: t.sans,
    fontSize: 12,
    color: "#7b887a",
    textAlign: "center",
  },
  bottomNotice: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#edf4ea",
    borderWidth: 1,
    borderColor: "#d7e5d5",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bottomNoticeText: {
    flex: 1,
    fontFamily: t.sans,
    fontSize: 12.5,
    color: "#3b573d",
    lineHeight: 16,
  },
});
