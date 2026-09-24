namespace InOut.Infrastructure.Persistence;

internal static class PersistenceVocabulary
{
    internal static class AuditOutcomes
    {
        internal const string Success = "success";
    }

    internal static class AuditActions
    {
        internal const string AccountArchived = "financial.account.archived";
        internal const string AccountCreated = "financial.account.created";
        internal const string CategoryCreated = "financial.category.created";
        internal const string CategoryArchived = "financial.category.archived";
        internal const string HouseholdCreated = "household.created";
        internal const string InvitationAccepted = "household.invitation.accepted";
        internal const string InvitationCreated = "household.invitation.created";
        internal const string OpeningBalancePosted = "financial.opening_balance.posted";
        internal const string TransactionPosted = "financial.transaction.posted";
        internal const string TransactionReversed = "financial.transaction.reversed";
    }

    internal static class EntityTypes
    {
        internal const string Account = "account";
        internal const string Category = "category";
        internal const string Household = "household";
        internal const string HouseholdInvitation = "household_invitation";
        internal const string Transaction = "transaction";
    }

    internal static class IdempotencyStatuses
    {
        internal const string Completed = "completed";
        internal const string FailedFinal = "failed_final";
        internal const string FailedRetryable = "failed_retryable";
        internal const string Processing = "processing";
    }

    internal static class InboxStatuses
    {
        internal const string Processed = "processed";
        internal const string Processing = "processing";
    }

    internal static class OperationNames
    {
        internal const string CreateAccount = "create_account";
        internal const string CreateCategory = "create_category";
        internal const string CreateRecurringPlan = "create_recurring_plan";
        internal const string PostExpense = "post_expense";
        internal const string PostIncome = "post_income";
        internal const string PostTransfer = "post_transfer";
        internal const string ReverseTransaction = "reverse_transaction";
    }

    internal static class MetricTags
    {
        internal const string Operation = "operation";
    }

    internal static class Metrics
    {
        internal const string Conflicts = "idempotency.conflicts";
        internal const string Failed = "idempotency.failed";
        internal const string InProgress = "idempotency.in_progress";
        internal const string MeterName = "InOut.Idempotency";
        internal const string MeterVersion = "1.0.0";
        internal const string Reclaimed = "idempotency.reclaimed";
        internal const string Replayed = "idempotency.replayed";
        internal const string Started = "idempotency.started";
    }

    internal static class StorageValues
    {
        internal const string OpeningBalance = "opening_balance";
    }

    internal static class SessionSettings
    {
        internal const string JwtSubject = "request.jwt.claim.sub";
    }

    internal static class Json
    {
        internal const string EmptyObject = "{}";
    }
}
