namespace InOut.Api;

internal static class ApiContract
{
    internal static class EndpointNames
    {
        internal const string AcceptHouseholdInvitation = "AcceptHouseholdInvitation";
        internal const string ArchiveAccount = "ArchiveAccount";
        internal const string CheckHouseholdAccess = "CheckHouseholdAccess";
        internal const string CreateAccount = "CreateAccount";
        internal const string CreateHousehold = "CreateHousehold";
        internal const string CreateHouseholdInvitation = "CreateHouseholdInvitation";
        internal const string GetAccountBalances = "GetAccountBalances";
        internal const string GetAccounts = "GetAccounts";
        internal const string GetCategories = "GetCategories";
        internal const string GetLedgerHistory = "GetLedgerHistory";
        internal const string GetSystemInfo = "GetSystemInfo";
        internal const string ListHouseholds = "ListHouseholds";
        internal const string PostExpense = "PostExpense";
        internal const string PostIncome = "PostIncome";
        internal const string PostTransfer = "PostTransfer";
        internal const string ReconcileLedger = "ReconcileLedger";
        internal const string ReverseTransaction = "ReverseTransaction";
    }

    internal static class Claims
    {
        internal const string Subject = "sub";
    }

    internal static class Configuration
    {
        internal const string AllowedOrigins = "Cors:AllowedOrigins";
        internal const string DatabaseConnection = "InOut";
        internal const string SupabaseAudience = "Supabase:Jwt:Audience";
        internal const string SupabaseIssuer = "Supabase:Jwt:Issuer";
    }

    internal static class Headers
    {
        internal const string IdempotencyKey = "Idempotency-Key";
        internal const string RetryAfter = "Retry-After";
    }

    internal static class HeaderValues
    {
        internal const string RetryAfterFiveSeconds = "5";
    }

    internal static class ProblemFields
    {
        internal const string Code = "code";
    }

    internal static class RouteValues
    {
        internal const string HouseholdId = "householdId";
    }

    internal static class Routes
    {
        internal const string AcceptInvitation = "/api/v1/household-invitations/accept";
        internal const string Accounts = "/accounts";
        internal const string AccountById = "/accounts/{accountId:guid}";
        internal const string Balances = "/balances";
        internal const string Categories = "/categories";
        internal const string Expenses = "/expenses";
        internal const string History = "/history";
        internal const string HouseholdAccess = "/api/v1/households/{householdId:guid}/access";
        internal const string Households = "/api/v1/households";
        internal const string HouseholdInvitations = "/{householdId:guid}/invitations";
        internal const string Income = "/income";
        internal const string Ledger = "/api/v1/households/{householdId:guid}/ledger";
        internal const string Liveness = "/health/live";
        internal const string Readiness = "/health/ready";
        internal const string Reconciliation = "/reconciliation";
        internal const string Reversals = "/transactions/{transactionId:guid}/reversals";
        internal const string Root = "/";
        internal const string SystemInfo = "/api/v1/system/info";
        internal const string Transfers = "/transfers";

        internal static string AccountResource(Guid householdId, Guid accountId) =>
            $"/api/v1/households/{householdId}/ledger/accounts/{accountId}";

        internal static string HouseholdResource(Guid householdId) =>
            $"/api/v1/households/{householdId}";

        internal static string InvitationResource(Guid householdId) =>
            $"/api/v1/households/{householdId}/invitations";

        internal static string TransactionResource(Guid householdId, Guid transactionId) =>
            $"/api/v1/households/{householdId}/ledger/transactions/{transactionId}";
    }

    internal static class ResponseValues
    {
        internal const string AccessGranted = "granted";
        internal const string Ready = "ready";
        internal const string ServiceName = "InOut.Api";
    }

    internal static class Tags
    {
        internal const string Households = "Households";
        internal const string Ledger = "Ledger";
    }
}
