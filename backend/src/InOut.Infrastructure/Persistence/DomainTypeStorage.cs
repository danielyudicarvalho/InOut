using InOut.Domain.Financial;
using InOut.Domain.Households;
using InOut.Domain.Utils;

namespace InOut.Infrastructure.Persistence;

internal static class DomainTypeStorage
{
    internal static string AccountKindToString(AccountKind value) => Lower(value);
    internal static AccountKind AccountKindFromString(string value) => Parse<AccountKind>(value);

    internal static string FinancialFlowToString(FinancialFlow value) => Lower(value);
    internal static FinancialFlow FinancialFlowFromString(string value) => Parse<FinancialFlow>(value);

    internal static string EntryDirectionToString(EntryDirection value) => Lower(value);
    internal static EntryDirection EntryDirectionFromString(string value) => Parse<EntryDirection>(value);

    internal static string TransactionKindToString(FinancialTransactionKind value) =>
        value is FinancialTransactionKind.OpeningBalance
            ? "opening_balance"
            : Lower(value);

    internal static FinancialTransactionKind TransactionKindFromString(string value) =>
        value == "opening_balance"
            ? FinancialTransactionKind.OpeningBalance
            : Parse<FinancialTransactionKind>(value);

    internal static string TransactionStatusToString(FinancialTransactionStatus value) => Lower(value);
    internal static FinancialTransactionStatus TransactionStatusFromString(string value) =>
        Parse<FinancialTransactionStatus>(value);

    internal static string HouseholdRoleToString(HouseholdRole value) => Lower(value);
    internal static HouseholdRole HouseholdRoleFromString(string value) => Parse<HouseholdRole>(value);

    private static string Lower<T>(T value) where T : struct, Enum =>
        StringUtils.NormalizeLower(value.ToString());

    private static T Parse<T>(string value) where T : struct, Enum =>
        Enum.Parse<T>(value, true);
}
