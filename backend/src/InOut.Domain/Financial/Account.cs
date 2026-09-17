using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

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

    public static AccountOpening Open(
        Guid id,
        Guid householdId,
        string? name,
        AccountKind kind,
        string currency,
        long initialBalanceCents,
        DateOnly openingDate,
        Guid idempotencyKey,
        Guid actorUserId)
    {
        if (initialBalanceCents < 0)
        {
            throw new FinancialRuleException(
                "invalid_initial_balance",
                "Initial balance cannot be negative.");
        }

        var account = Create(id, householdId, name, kind, currency);
        var openingBalance = initialBalanceCents == 0
            ? null
            : FinancialTransaction.OpeningBalance(
                householdId,
                id,
                Money.Positive(initialBalanceCents, account.Currency),
                openingDate,
                idempotencyKey,
                actorUserId);
        return new AccountOpening(account, openingBalance, idempotencyKey);
    }

    public Account Archive(DateTimeOffset archivedAt) =>
        IsActive ? this with { ArchivedAt = archivedAt } : this;

    public static string NormalizeName(string? name)
    {
        var normalized = StringUtils.TrimToNull(name);
        if (string.IsNullOrEmpty(normalized) || normalized.Length > 80)
        {
            throw new FinancialRuleException(
                "invalid_account_name",
                "Account name must contain between 1 and 80 characters.");
        }

        return normalized;
    }
}

public sealed record AccountOpening(
    Account Account,
    FinancialTransaction? OpeningBalance,
    Guid IdempotencyKey);
