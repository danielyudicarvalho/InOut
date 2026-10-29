import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { money, type CorrectionChainStep } from "@inout/finance";
import { useCorrectionHistory } from "../finance/use-correction-history";
import { theme as t } from "../theme";

export function CorrectionHistoryScreen() {
  const p = useLocalSearchParams();
  const household = typeof p.household === "string" ? p.household : "";
  const transactionId = typeof p.transaction === "string" ? p.transaction : "";
  const period = typeof p.period === "string" ? p.period : "";
  const currency = typeof p.currency === "string" ? p.currency : "";

  return (
    <CorrectionHistoryView
      key={`${household}:${transactionId}`}
      household={household}
      transactionId={transactionId}
      period={period}
      currency={currency}
    />
  );
}

function formatAuditDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const dateFormatted = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
    const timeFormatted = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `${dateFormatted} às ${timeFormatted}`;
  } catch {
    return dateString;
  }
}

function StepIcon({ step }: { step: CorrectionChainStep }) {
  if (step.kind === "reversal") {
    return (
      <MaterialCommunityIcons
        name="cached"
        size={24}
        color="#c78d30"
        accessible={false}
      />
    );
  }
  if (step.detail.kind === "transfer") {
    return (
      <MaterialCommunityIcons
        name="swap-horizontal"
        size={24}
        color="#3b5a7a"
        accessible={false}
      />
    );
  }
  if (step.detail.kind === "income") {
    return (
      <MaterialCommunityIcons
        name="cash-plus"
        size={24}
        color="#2e663a"
        accessible={false}
      />
    );
  }
  return (
    <MaterialCommunityIcons
      name="cart-outline"
      size={24}
      color="#b85b43"
      accessible={false}
    />
  );
}

function CorrectionHistoryView({
  household,
  transactionId,
  period,
  currency,
}: {
  household: string;
  transactionId: string;
  period: string;
  currency: string;
}) {
  const state = useCorrectionHistory(household, transactionId);

  const back = () =>
    router.replace({
      pathname: "/lancamentos",
      params: {
        household,
        ...(period ? { period } : {}),
        currency: state.chain?.currency ?? currency,
      },
    });

  const target = (id: string) =>
    router.push({
      pathname: "/lancamento",
      params: {
        household,
        transaction: id,
        ...(period ? { period } : {}),
        currency: state.chain?.currency ?? currency,
      },
    });

  if (state.status === "loading" || state.status === "error" || !state.chain) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.stateContainer}>
          <Text style={s.title}>Histórico de correções</Text>
          <Text accessibilityLiveRegion="polite" style={s.stateText}>
            {state.status === "loading"
              ? "Carregando histórico de correções…"
              : state.notice}
          </Text>
          {state.status !== "loading" && (
            <Pressable style={s.button} onPress={state.retry}>
              <Text style={s.buttonText}>Tentar novamente</Text>
            </Pressable>
          )}
          <Pressable style={s.button} onPress={back}>
            <Text style={s.buttonText}>Voltar aos lançamentos</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { chain } = state;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Breadcrumb & Navigation */}
        <View style={s.breadcrumbRow}>
          <Pressable onPress={back} style={s.breadcrumbPressable}>
            <Text style={s.breadcrumbLink}>Lançamentos</Text>
          </Pressable>
          <Text style={s.breadcrumbSeparator}>/</Text>
          <Text style={s.breadcrumbCurrent}>Histórico de correções</Text>
        </View>

        {/* Title & Header */}
        <Text accessibilityRole="header" style={s.title}>
          Histórico de correções
        </Text>
        <Text style={s.subtitle}>
          Acompanhe os vínculos e as alterações deste lançamento.
        </Text>

        {/* Illustration */}
        <View style={s.artContainer}>
          <Image
            accessible={false}
            source={require("../../assets/pipo-correction-history.webp")}
            style={s.art}
          />
        </View>

        {/* Timeline */}
        <View style={s.timeline}>
          {chain.steps.map((step, idx) => {
            const isOriginal = step.kind === "original";
            const isReversal = step.kind === "reversal";
            const signedAmount =
              step.detail.amount < 0
                ? `- ${money(Math.abs(step.detail.amount), step.detail.currency)}`
                : `+ ${money(step.detail.amount, step.detail.currency)}`;

            const categoryRow = step.detail.rows.find(
              (r) => r.label === "Categoria",
            );
            const subcategoryRow = step.detail.rows.find(
              (r) => r.label === "Subcategoria",
            );
            const accountName =
              step.detail.postings[0]?.accountName || "Conta principal";

            const markerBg =
              step.step === 1
                ? "#b85b43"
                : step.step === 2
                  ? "#cb8e34"
                  : "#497143";

            const iconBg =
              step.step === 1
                ? "#fbece5"
                : step.step === 2
                  ? "#fbf4e1"
                  : "#eff5ed";

            return (
              <View key={step.detail.id} style={s.stepRow}>
                {/* Marker & Connecting line */}
                <View style={s.markerCol}>
                  <View style={[s.markerBadge, { backgroundColor: markerBg }]}>
                    <Text style={s.markerText}>{step.step}</Text>
                  </View>
                  {idx < chain.steps.length - 1 && <View style={s.stepLine} />}
                </View>

                {/* Step Content */}
                <View style={s.stepBody}>
                  <Text style={[s.stepTitle, { color: markerBg }]}>
                    {step.title}
                  </Text>

                  <View style={s.card}>
                    {/* Top Row: Icon + Title + Flow Tag */}
                    <View style={s.cardHeader}>
                      <View
                        style={[s.iconWrapper, { backgroundColor: iconBg }]}
                      >
                        <StepIcon step={step} />
                      </View>
                      <View style={s.cardTitleBlock}>
                        <Text style={s.cardTitle}>
                          {isReversal
                            ? "Compensação do lançamento original"
                            : step.detail.description}
                        </Text>
                        {!isReversal && (
                          <View
                            style={[
                              s.flowTag,
                              step.detail.kind === "income"
                                ? s.flowTagIncome
                                : step.detail.kind === "transfer"
                                  ? s.flowTagTransfer
                                  : s.flowTagExpense,
                            ]}
                          >
                            <Text
                              style={[
                                s.flowTagText,
                                step.detail.kind === "income"
                                  ? s.flowTextIncome
                                  : step.detail.kind === "transfer"
                                    ? s.flowTextTransfer
                                    : s.flowTextExpense,
                              ]}
                            >
                              {step.detail.kind === "expense"
                                ? "Saída"
                                : step.detail.kind === "income"
                                  ? "Entrada"
                                  : "Transferência"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Subtitle / Details */}
                    {isReversal ? (
                      <Text style={s.metaSubtitle}>
                        {step.reason || "Motivo: valor informado incorretamente."}
                      </Text>
                    ) : (
                      <Text style={s.metaSubtitle}>
                        {accountName}
                        {categoryRow ? ` · ${categoryRow.value}` : ""}
                        {subcategoryRow ? ` > ${subcategoryRow.value}` : ""}
                      </Text>
                    )}

                    {/* Audit Row */}
                    <View style={s.auditRow}>
                      <MaterialCommunityIcons
                        name="account-outline"
                        size={14}
                        color="#8c998e"
                        accessible={false}
                      />
                      <Text style={s.auditText}>
                        {step.detail.createdBy || "Daniel Yudi"} ·{" "}
                        {formatAuditDate(step.detail.postedAt)}
                      </Text>
                    </View>

                    {/* Amount & Actions Row */}
                    <View style={s.amountRow}>
                      <View style={s.amountPills}>
                        <Text
                          style={[
                            s.amountText,
                            step.detail.amount < 0
                              ? s.amountOut
                              : s.amountIn,
                          ]}
                        >
                          {signedAmount}
                        </Text>
                        <View
                          style={[
                            s.statusPill,
                            step.statusBadge === "Estornado"
                              ? s.pillReversed
                              : s.pillRegistered,
                          ]}
                        >
                          <Text
                            style={[
                              s.statusPillText,
                              step.statusBadge === "Estornado"
                                ? s.pillTextReversed
                                : s.pillTextRegistered,
                            ]}
                          >
                            {step.statusBadge}
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        style={s.actionLink}
                        onPress={() => target(step.detail.id)}
                      >
                        <MaterialCommunityIcons
                          name="eye-outline"
                          size={15}
                          color="#49634d"
                          accessible={false}
                        />
                        <Text style={s.actionLinkText}>
                          Ver{" "}
                          {isOriginal
                            ? "original"
                            : isReversal
                              ? "estorno"
                              : "substituição"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Footnote */}
                  {step.note ? (
                    <Text style={s.stepNote}>{step.note}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Net Effect Summary Banner */}
        <View style={s.summaryBanner}>
          <View style={s.bannerInfoRow}>
            <MaterialCommunityIcons
              name="information"
              size={18}
              color="#3f5d43"
              accessible={false}
            />
            <Text style={s.bannerInfoText}>
              {chain.hasSubstitute
                ? "A substituição é um novo lançamento vinculado. Os registros anteriores permanecem no histórico."
                : "O estorno é uma movimentação de compensação vinculada. Os registros anteriores permanecem no histórico."}
            </Text>
          </View>
          <View style={s.bannerNetRow}>
            <MaterialCommunityIcons
              name="cash"
              size={20}
              color="#26442a"
              accessible={false}
            />
            <Text style={s.bannerNetText}>
              Efeito final desta cadeia:{" "}
              <Text style={s.bannerNetStrong}>{chain.netLabel}</Text>.
            </Text>
          </View>
        </View>

        {/* Back Button */}
        <Pressable
          style={s.backButton}
          onPress={() => target(transactionId)}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={18}
            color="#2c4a30"
            accessible={false}
          />
          <Text style={s.backButtonText}>Voltar ao lançamento</Text>
        </Pressable>
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
    padding: 18,
    paddingBottom: 40,
  },
  stateContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stateText: {
    fontSize: 15,
    color: "#6b776a",
    textAlign: "center",
  },
  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  breadcrumbPressable: {
    paddingVertical: 2,
  },
  breadcrumbLink: {
    fontSize: 13,
    color: "#556c57",
    fontWeight: "500",
  },
  breadcrumbSeparator: {
    fontSize: 13,
    color: "#b0bcb0",
  },
  breadcrumbCurrent: {
    fontSize: 13,
    color: "#7b887a",
  },
  title: {
    fontFamily: t.serif,
    fontSize: 26,
    fontWeight: "700",
    color: "#1e3020",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#5e6f5f",
    marginBottom: 16,
    lineHeight: 20,
  },
  artContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  art: {
    width: "100%",
    maxWidth: 290,
    height: 170,
    resizeMode: "contain",
  },
  timeline: {
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
  },
  markerCol: {
    alignItems: "center",
    width: 26,
  },
  markerBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  markerText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#e5d8cb",
    marginVertical: 4,
  },
  stepBody: {
    flex: 1,
    paddingBottom: 22,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eedecf",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: "#503214",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#212f22",
    flexShrink: 1,
  },
  flowTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  flowTagExpense: {
    backgroundColor: "#faece5",
  },
  flowTagIncome: {
    backgroundColor: "#ebf4e8",
  },
  flowTagTransfer: {
    backgroundColor: "#eef1f6",
  },
  flowTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  flowTextExpense: {
    color: "#ab4c36",
  },
  flowTextIncome: {
    color: "#2e663a",
  },
  flowTextTransfer: {
    color: "#3b5a7a",
  },
  metaSubtitle: {
    fontSize: 13,
    color: "#637365",
  },
  auditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  auditText: {
    fontSize: 12,
    color: "#8c998e",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3ede3",
    marginTop: 4,
  },
  amountPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  amountText: {
    fontSize: 16,
    fontWeight: "700",
  },
  amountOut: {
    color: "#b85b43",
  },
  amountIn: {
    color: "#346b3e",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pillReversed: {
    backgroundColor: "#faeae3",
  },
  pillRegistered: {
    backgroundColor: "#e9f1e6",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  pillTextReversed: {
    color: "#b3513a",
  },
  pillTextRegistered: {
    color: "#33693d",
  },
  actionLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#f5f0e8",
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#49634d",
  },
  stepNote: {
    fontSize: 12,
    color: "#728274",
    marginTop: 6,
    marginLeft: 4,
  },
  summaryBanner: {
    backgroundColor: "#edf3eb",
    borderWidth: 1,
    borderColor: "#d9e6d6",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  bannerInfoRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  bannerInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#3f5d43",
    lineHeight: 18,
  },
  bannerNetRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#cfe0cb",
  },
  bannerNetText: {
    fontSize: 14,
    color: "#26442a",
  },
  bannerNetStrong: {
    fontWeight: "700",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c7d8c4",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: "#2c4a30",
    fontSize: 14,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#2c4a30",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
