namespace InOut.Domain.Financial;

public enum AccountKind
{
    Cash,
    Checking,
    Savings,
    Investment,
    Other
}

public sealed record Account(
    Guid Id,
    Guid HouseholdId,
    string Name,
    AccountKind Kind,
    string Currency,
    DateTimeOffset? ArchivedAt)
{
    public bool IsActive => ArchivedAt is null;

    public static Account Create(
        Guid id,
        Guid householdId,
        string? name,
        AccountKind kind,
        string currency)
    {
        if (id == Guid.Empty || householdId == Guid.Empty)
        {
            throw new FinancialRuleException("invalid_account_id", "Account and household identifiers are required.");
        }

        return new Account(id, householdId, NormalizeName(name), kind, new Money(0, currency).Currency, null);
    }

    public static string NormalizeName(string? name)
    {
        var normalized = name?.Trim();
        if (string.IsNullOrEmpty(normalized) || normalized.Length > 80)
        {
            throw new FinancialRuleException(
                "invalid_account_name",
                "Account name must contain between 1 and 80 characters.");
        }

        return normalized;
    }
}
