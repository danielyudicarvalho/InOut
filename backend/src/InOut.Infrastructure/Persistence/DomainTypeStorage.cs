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
            ? PersistenceVocabulary.StorageValues.OpeningBalance
            : Lower(value);

    internal static FinancialTransactionKind TransactionKindFromString(string value) =>
        value == PersistenceVocabulary.StorageValues.OpeningBalance
            ? FinancialTransactionKind.OpeningBalance
            : Parse<FinancialTransactionKind>(value);

    internal static string TransactionStatusToString(FinancialTransactionStatus value) => Lower(value);
    internal static FinancialTransactionStatus TransactionStatusFromString(string value) =>
        Parse<FinancialTransactionStatus>(value);

    internal static string HouseholdRoleToString(HouseholdRole value) => Lower(value);
    internal static HouseholdRole HouseholdRoleFromString(string value) => Parse<HouseholdRole>(value);

    internal static string AccountStatusToString(AccountStatus value) => Lower(value);
    internal static AccountStatus AccountStatusFromString(string value) => Parse<AccountStatus>(value);

    internal static string CategoryStatusToString(CategoryStatus value) => Lower(value);
    internal static CategoryStatus CategoryStatusFromString(string value) => Parse<CategoryStatus>(value);

    internal static string IncomeSourceStatusToString(IncomeSourceStatus value) => Lower(value);
    internal static IncomeSourceStatus IncomeSourceStatusFromString(string value) => Parse<IncomeSourceStatus>(value);

    internal static string GoalStatusToString(GoalStatus value) => Lower(value);
    internal static GoalStatus GoalStatusFromString(string value) => Parse<GoalStatus>(value);

    internal static string RecurringPlanStatusToString(RecurringPlanStatus value) => Lower(value);
    internal static RecurringPlanStatus RecurringPlanStatusFromString(string value) => Parse<RecurringPlanStatus>(value);

    private static string Lower<T>(T value) where T : struct, Enum =>
        StringUtils.NormalizeLower(value.ToString());

    private static T Parse<T>(string value) where T : struct, Enum =>
        Enum.Parse<T>(value, true);
}
