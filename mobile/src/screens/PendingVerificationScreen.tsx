import { useEffect } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { RecordKind, RecordReview } from "@inout/finance";
import { useFinancialHome } from "../finance/use-financial-home";
import { usePendingVerification } from "../finance/use-pending-verification";
import {
  VerificationCard,
  VerificationWarning,
  VerificationActions,
  VerificationBottomNotice,
} from "../components/verification";
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

  const resolvedHousehold = qHousehold || home.householdId || "";
  const activeHouseholdName =
    householdName ||
    home.households.find((h) => h.id === resolvedHousehold)?.name ||
    "Nosso Ninho";

  // Connect to real backend verification
  const backend = usePendingVerification({
    householdId: resolvedHousehold,
    initialKind: qKind,
    initialCurrency: qCurrency,
    initialDescription: qDescription,
    initialAmount: qAmount,
    initialDate: qDate,
    initialAccount: qAccount,
  });

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

  useEffect(() => {
    if (backend.confirmedTransaction) {
      router.replace({
        pathname: "/lancamento",
        params: {
          ...(resolvedHousehold ? { household: resolvedHousehold } : {}),
          transaction: backend.confirmedTransaction,
          ...(qPeriod ? { period: qPeriod } : {}),
          currency: qCurrency,
        },
      });
    }
  }, [backend.confirmedTransaction, resolvedHousehold, qPeriod, qCurrency]);

  const handleVerify = () => {
    if (onRetry) {
      onRetry();
    } else {
      void backend.verify();
    }
  };

  const isSubmitting = submitting || backend.status === "verifying";

  const activeDescription = backend.data.hasStoredPending ? backend.data.description : qDescription;
  const activeAmount = backend.data.hasStoredPending ? backend.data.amount : qAmount;
  const activeDate = backend.data.hasStoredPending ? backend.data.date : qDate;
  const activeKind = backend.data.hasStoredPending ? backend.data.kind : qKind;

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
              name="sprout"
              size={24}
              color="#2d7a3e"
              accessible={false}
            />
            <Text style={s.brandName}>Ninho</Text>
          </View>

          <View style={s.residencePill}>
            <MaterialCommunityIcons
              name="home-outline"
              size={15}
              color="#2d7a3e"
              accessible={false}
            />
            <Text style={s.residenceText} numberOfLines={1}>
              {activeHouseholdName}
            </Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={14}
              color="#526251"
              accessible={false}
            />
          </View>

          <View style={s.notificationIcon}>
            <MaterialCommunityIcons
              name="bell-outline"
              size={20}
              color="#3a4b3b"
              accessible={false}
            />
          </View>
        </View>

        {/* Mascot Artwork */}
        <View style={s.heroArtwork}>
          <Image
            source={require("../../assets/pipo-verifying-record.webp")}
            style={s.heroImage}
            resizeMode="contain"
            accessibilityLabel="Pipo conferindo as anotações do lançamento com uma ampulheta ao lado"
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

        {backend.notice && backend.status === "uncertain" ? (
          <Text accessibilityRole="alert" style={s.notice}>
            {backend.notice}
          </Text>
        ) : null}

        {/* Transaction Summary Card */}
        <VerificationCard
          kind={activeKind}
          description={activeDescription}
          amount={activeAmount}
          currency={qCurrency}
          accountName={qAccount}
          date={activeDate}
        />

        {/* Callout Warning */}
        <VerificationWarning />

        {/* Action Buttons */}
        <VerificationActions
          onVerify={handleVerify}
          onHistory={backToHistory}
          submitting={isSubmitting}
        />

        {/* Bottom Sprout Safe Exit Notice */}
        <VerificationBottomNotice />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: t.cream,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxWidth: 580,
    width: "100%",
    alignSelf: "center",
    alignItems: "center",
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandName: {
    fontFamily: t.serif,
    fontSize: 20,
    fontWeight: "700",
    color: "#1e3323",
  },
  residencePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e1d5",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    maxWidth: "52%",
  },
  residenceText: {
    fontFamily: t.sans,
    fontSize: 13,
    fontWeight: "600",
    color: "#2d4a30",
    flexShrink: 1,
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroArtwork: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  heroImage: {
    width: 250,
    height: 180,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 25,
    fontWeight: "700",
    color: "#173e2b",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 31,
  },
  subtitle: {
    fontFamily: t.sans,
    fontSize: 14,
    color: "#4c5749",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  notice: {
    fontFamily: t.sans,
    fontSize: 13,
    color: "#9b4229",
    backgroundColor: "#fbf2eb",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    width: "100%",
    textAlign: "center",
  },
});
