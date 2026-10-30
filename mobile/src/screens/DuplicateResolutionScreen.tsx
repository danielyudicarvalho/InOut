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
import { money, displayDate } from "@inout/finance";
import { useDuplicateResolution } from "../finance/use-duplicate-resolution";
import { theme as t } from "../theme";

export function DuplicateResolutionScreen() {
  const p = useLocalSearchParams();
  const household = typeof p.household === "string" ? p.household : "";
  const firstId =
    typeof p.first === "string"
      ? p.first
      : typeof p.t1 === "string"
        ? p.t1
        : typeof p.transaction === "string"
          ? p.transaction
          : "";
  const secondId =
    typeof p.second === "string"
      ? p.second
      : typeof p.t2 === "string"
        ? p.t2
        : "";
  const period = typeof p.period === "string" ? p.period : "";
  const currency = typeof p.currency === "string" ? p.currency : "";

  return (
    <DuplicateResolutionView
      key={`${household}:${firstId}:${secondId}`}
      household={household}
      firstId={firstId}
      secondId={secondId}
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

function DuplicateResolutionView({
  household,
  firstId,
  secondId,
  period,
  currency,
}: {
  household: string;
  firstId: string;
  secondId: string;
  period: string;
  currency: string;
}) {
  const state = useDuplicateResolution(household, firstId, secondId);

  const back = () =>
    router.replace({
      pathname: "/lancamentos",
      params: {
        household,
        ...(period ? { period } : {}),
        currency,
      },
    });

  if (
    state.status === "loading" ||
    state.status === "error" ||
    !state.comparison
  ) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.stateContainer}>
          <Text style={s.title}>Resolver duplicidade</Text>
          <Text accessibilityLiveRegion="polite" style={s.stateText}>
            {state.status === "loading"
              ? "Carregando registros duplicados…"
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

  const { comparison, selectedId } = state;
  const records = [comparison.first, comparison.second];
  const selectedRecord =
    records.find((r) => r.id === selectedId) || comparison.second;

  const handleReviewReversal = () => {
    router.push({
      pathname: "/lancamento",
      params: {
        household,
        transaction: selectedRecord.id,
        ...(period ? { period } : {}),
        currency: selectedRecord.currency,
        action: "reverse",
      },
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Breadcrumb */}
        <View style={s.breadcrumbRow}>
          <Pressable onPress={back}>
            <Text style={s.breadcrumbLink}>Lançamentos</Text>
          </Pressable>
          <Text style={s.breadcrumbSeparator}>/</Text>
          <Text style={s.breadcrumbCurrent}>Resolver duplicidade</Text>
        </View>

        {/* Title */}
        <Text accessibilityRole="header" style={s.title}>
          Resolver duplicidade
        </Text>
        <Text style={s.subtitle}>
          Compare os registros e escolha qual deve ser estornado.
        </Text>

        {/* Mascot */}
        <View style={s.artContainer}>
          <Image
            accessible={false}
            source={require("../../assets/pipo-duplicates.webp")}
            style={s.art}
          />
        </View>

        {/* Info Banner */}
        <View style={s.infoBanner}>
          <MaterialCommunityIcons
            name="information"
            size={18}
            color="#49654d"
            accessible={false}
          />
          <Text style={s.infoText}>
            Registros selecionados manualmente para comparação.
          </Text>
        </View>

        {/* Cards */}
        <View style={s.cardsContainer}>
          {records.map((record) => {
            const isSelected = record.id === selectedId;
            const categoryText = [record.categoryName, record.subcategoryName]
              .filter(Boolean)
              .join(" › ");

            return (
              <Pressable
                key={record.id}
                style={[s.card, isSelected && s.cardSelected]}
                onPress={() => state.select(record.id)}
              >
                {/* Radio Header */}
                <View style={s.radioRow}>
                  <MaterialCommunityIcons
                    name={isSelected ? "radiobox-marked" : "radiobox-blank"}
                    size={20}
                    color={isSelected ? "#b85b43" : "#8c9b8d"}
                    accessible={false}
                  />
                  <Text
                    style={[s.radioLabel, isSelected && s.radioLabelSelected]}
                  >
                    {isSelected
                      ? "Selecionado para estorno"
                      : "Selecionar para estorno"}
                  </Text>
                </View>

                {/* Details */}
                <View style={s.cardBody}>
                  <View style={s.rowWithIcon}>
                    <MaterialCommunityIcons
                      name="file-document-outline"
                      size={18}
                      color="#3e5241"
                      accessible={false}
                    />
                    <Text style={s.recordTitle}>{record.description}</Text>
                  </View>

                  <View style={s.rowWithIcon}>
                    <MaterialCommunityIcons
                      name={
                        record.kind === "expense"
                          ? "arrow-top-right"
                          : "arrow-bottom-left"
                      }
                      size={18}
                      color={record.kind === "expense" ? "#b85b43" : "#326b3e"}
                      accessible={false}
                    />
                    <Text
                      style={[
                        s.flowText,
                        record.kind === "expense"
                          ? s.flowExpense
                          : s.flowIncome,
                      ]}
                    >
                      {record.kind === "expense"
                        ? "Saída"
                        : record.kind === "income"
                          ? "Entrada"
                          : "Transferência"}
                    </Text>
                  </View>

                  <View style={s.rowWithIcon}>
                    <MaterialCommunityIcons
                      name="currency-usd"
                      size={18}
                      color="#b85b43"
                      accessible={false}
                    />
                    <Text style={s.amountText}>
                      {money(Math.abs(record.amount), record.currency)}
                    </Text>
                  </View>

                  <View style={s.rowWithIcon}>
                    <MaterialCommunityIcons
                      name="credit-card-outline"
                      size={18}
                      color="#5f7161"
                      accessible={false}
                    />
                    <Text style={s.metaText}>{record.accountName}</Text>
                  </View>

                  {categoryText ? (
                    <View style={s.rowWithIcon}>
                      <MaterialCommunityIcons
                        name="tag-outline"
                        size={18}
                        color="#5f7161"
                        accessible={false}
                      />
                      <Text style={s.metaText}>{categoryText}</Text>
                    </View>
                  ) : null}

                  <View style={s.rowWithIcon}>
                    <MaterialCommunityIcons
                      name="calendar-blank-outline"
                      size={18}
                      color="#5f7161"
                      accessible={false}
                    />
                    <Text style={s.metaText}>{displayDate(record.date)}</Text>
                  </View>

                  <View style={s.rowWithIcon}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={18}
                      color="#366f42"
                      accessible={false}
                    />
                    <Text style={s.statusText}>{record.status}</Text>
                  </View>

                  <View style={s.cardDivider} />

                  <View style={s.auditBlock}>
                    <View style={s.auditLine}>
                      <Text style={s.auditLabel}># Identificador</Text>
                      <Text style={s.auditValue}>{record.displayId}</Text>
                    </View>
                    <View style={s.auditLine}>
                      <Text style={s.auditLabel}>Criado por</Text>
                      <Text style={s.auditValue}>
                        {record.createdBy || "Usuário"}
                      </Text>
                    </View>
                    <View style={s.auditLine}>
                      <Text style={s.auditLabel}>Criado em</Text>
                      <Text style={s.auditValue}>
                        {formatAuditDate(record.postedAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Confirmation Floating Card */}
        <View style={s.confirmationCard}>
          <View style={s.confirmationHeader}>
            <View style={s.checkCircle}>
              <MaterialCommunityIcons
                name="check"
                size={18}
                color="#ffffff"
                accessible={false}
              />
            </View>
            <View style={s.confirmationCopy}>
              <Text style={s.confirmationTitle}>
                Você selecionou {selectedRecord.displayId} para estorno.
              </Text>
              <Text style={s.confirmationSub}>
                O outro registro será mantido. Você revisará o estorno antes de
                confirmar.
              </Text>
            </View>
          </View>

          <View style={s.actionRow}>
            <Pressable style={s.cancelBtn} onPress={back}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable style={s.reviewBtn} onPress={handleReviewReversal}>
              <Text style={s.reviewBtnText}>Revisar estorno</Text>
            </Pressable>
          </View>
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
    padding: 16,
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
    marginBottom: 8,
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
    marginBottom: 16,
  },
  art: {
    width: "100%",
    maxWidth: 280,
    height: 160,
    resizeMode: "contain",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#edf4ea",
    borderWidth: 1,
    borderColor: "#dae7d8",
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#415c45",
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eedecf",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#503214",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardSelected: {
    borderColor: "#d9856c",
    backgroundColor: "#fcf8f4",
    borderWidth: 1.5,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  radioLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7a8a7c",
  },
  radioLabelSelected: {
    color: "#b85b43",
  },
  cardBody: {
    gap: 8,
  },
  rowWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#212f22",
  },
  flowText: {
    fontSize: 13,
    fontWeight: "600",
  },
  flowExpense: {
    color: "#b85b43",
  },
  flowIncome: {
    color: "#326b3e",
  },
  amountText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#b85b43",
  },
  metaText: {
    fontSize: 13,
    color: "#5b6b5d",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#33693d",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#f0e6dc",
    marginVertical: 6,
  },
  auditBlock: {
    gap: 4,
  },
  auditLine: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  auditLabel: {
    fontSize: 12,
    color: "#8a968b",
  },
  auditValue: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4f5f51",
  },
  confirmationCard: {
    backgroundColor: "#f2f7ef",
    borderWidth: 1,
    borderColor: "#d6e5d3",
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  confirmationHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4c7746",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationCopy: {
    flex: 1,
    gap: 2,
  },
  confirmationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#223b26",
  },
  confirmationSub: {
    fontSize: 12,
    color: "#506953",
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#c1d4bf",
    backgroundColor: "#ffffff",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#465f49",
  },
  reviewBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#b85b43",
  },
  reviewBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
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
