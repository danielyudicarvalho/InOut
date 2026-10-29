import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { money, displayDate, type RecordKind } from "@inout/finance";
import { theme as t } from "../../theme";

export interface VerificationCardProps {
  kind: RecordKind;
  description: string;
  amount: number;
  currency: string;
  accountName: string;
  date: string;
}

export function VerificationCard({
  kind,
  description,
  amount,
  currency,
  accountName,
  date,
}: VerificationCardProps) {
  const isExpense = kind === "expense";
  const isIncome = kind === "income";
  const isTransfer = kind === "transfer";

  const formattedAmount = money(Math.abs(amount), currency);

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.iconWrapper}>
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
          {description.trim() ||
            (isTransfer
              ? "Transferência"
              : isIncome
                ? "Entrada"
                : "Saída")}
        </Text>

        <View style={s.badge}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={13}
            color="#9a4811"
            accessible={false}
          />
          <Text style={s.badgeText}>Em verificação</Text>
        </View>
      </View>

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
          <Text style={[s.fieldValue, s.amountValue]}>{formattedAmount}</Text>
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
          <Text style={s.fieldValue}>{accountName || "Conta principal"}</Text>
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
          <Text style={s.fieldValue}>{displayDate(date)}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eae5d9",
    width: "100%",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#e8f0e8",
    alignItems: "center",
    justifyContent: "center",
  },
  recordTitle: {
    fontFamily: t.serif,
    fontSize: 17,
    fontWeight: "700",
    color: "#173e2b",
    flex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fef3c7",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  badgeText: {
    fontFamily: t.sans,
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
  },
  rowsContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f2ede2",
    paddingTop: 12,
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f7f4ee",
  },
  fieldLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldLabel: {
    fontFamily: t.sans,
    fontSize: 13,
    color: "#6b7767",
  },
  fieldValue: {
    fontFamily: t.sans,
    fontSize: 14,
    fontWeight: "600",
    color: "#1e3323",
  },
  amountValue: {
    fontWeight: "700",
    color: "#173e2b",
  },
});
