namespace InOut.Domain.Financial;

public enum FinancialFlow
{
    Income,
    Expense
}

public sealed record Category(
    Guid Id,
    Guid HouseholdId,
    FinancialFlow Flow,
    DateTimeOffset? ArchivedAt)
{
    public bool IsActive => ArchivedAt is null;
}
