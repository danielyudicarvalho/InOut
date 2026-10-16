using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public sealed record Account
{
    public const int MaxNameLength = 80;

    public Guid Id { get; init; }
    public Guid HouseholdId { get; init; }
    public string Name { get; init; }
    public AccountKind Kind { get; init; }
    public string Currency { get; init; }
    public DateTimeOffset? ArchivedAt { get; init; }
    public AccountStatus Status { get; init; }

    public Account(
        Guid id,
        Guid householdId,
        string name,
        AccountKind kind,
        string currency,
        DateTimeOffset? archivedAt,
        AccountStatus status = AccountStatus.Active)
    {
        Id = id;
        HouseholdId = householdId;
        Name = name;
        Kind = kind;
        Currency = currency;
        ArchivedAt = archivedAt;
        Status = archivedAt is not null ? AccountStatus.Archived : status;
    }

    public bool IsActive => Status == AccountStatus.Active;
    public bool CanTransact => IsActive;
    public bool CanUpdateMetadata => IsActive;

    // --- Invariants & Validations ---

    public void EnsureCanTransact()
    {
        switch (Status)
        {
            case AccountStatus.Archived:
                throw new FinancialRuleException(
                    FinancialErrorCodes.AccountArchived,
                    "Archived accounts cannot accept transactions.");
            case AccountStatus.Frozen:
                throw new FinancialRuleException(
                    FinancialErrorCodes.AccountFrozen,
                    "Account is frozen and cannot accept transactions.");
            case not AccountStatus.Active:
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidAccount,
                    $"Account status '{Status}' does not permit transactions.");
        }
    }

    public void EnsureCanUpdateMetadata()
    {
        switch (Status)
        {
            case AccountStatus.Archived:
                throw new FinancialRuleException(
                    FinancialErrorCodes.AccountArchived,
                    "Archived accounts cannot be updated.");
            case AccountStatus.Frozen:
                throw new FinancialRuleException(
                    FinancialErrorCodes.AccountFrozen,
                    "Frozen accounts cannot be updated.");
            case not AccountStatus.Active:
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidAccount,
                    $"Account status '{Status}' does not permit updates.");
        }
    }

    public void EnsureBelongsToHousehold(Guid householdId)
    {
        if (HouseholdId != householdId)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAccount,
                "Account does not belong to the household.");
        }
    }

    // --- State Transitions ---

    public Account Freeze()
    {
        if (Status == AccountStatus.Archived)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.AccountArchived,
                "Archived account cannot be frozen.");
        }

        return Status == AccountStatus.Frozen 
            ? this 
            : this with { Status = AccountStatus.Frozen };
    }

    public Account Unfreeze()
    {
        if (Status == AccountStatus.Archived)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.AccountArchived,
                "Archived account cannot be unfrozen.");
        }

        return Status == AccountStatus.Frozen 
            ? this with { Status = AccountStatus.Active } 
            : this;
    }

    public Account Archive(DateTimeOffset archivedAt) =>
        Status == AccountStatus.Archived
            ? this
            : this with { ArchivedAt = archivedAt, Status = AccountStatus.Archived };

    public Account UpdateMetadata(string? newName, AccountKind newKind)
    {
        EnsureCanUpdateMetadata();
        return this with { Name = NormalizeName(newName), Kind = newKind };
    }

    // --- Factory Methods ---

    public static Account Create(
        Guid id,
        Guid householdId,
        string? name,
        AccountKind kind,
        string currency)
    {
        if (id == Guid.Empty || householdId == Guid.Empty)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAccountId,
                "Account and household identifiers are required.");
        }

        var normalizedName = NormalizeName(name);
        var validatedCurrency = new Money(0, currency).Currency;

        return new Account(
            id,
            householdId,
            normalizedName,
            kind,
            validatedCurrency,
            null,
            AccountStatus.Active);
    }

    public static AccountOpening Open(
        Guid id,
        Guid householdId,
        string? name,
        AccountKind kind,
        string currency,
        long initialBalanceCents,
        DateOnly openingDate,
        Guid actorUserId)
    {
        if (initialBalanceCents < 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidInitialBalance,
                "Initial balance cannot be negative.");
        }

        var account = Create(id, householdId, name, kind, currency);

        var openingBalance = initialBalanceCents == 0
            ? null
            : FinancialTransaction.OpeningBalance(
                householdId,
                account.Id,
                Money.Positive(initialBalanceCents, account.Currency),
                openingDate,
                actorUserId);

        return new AccountOpening(account, openingBalance);
    }

    public static string NormalizeName(string? name)
    {
        var normalized = StringUtils.TrimToNull(name);
        if (string.IsNullOrEmpty(normalized) || normalized.Length > MaxNameLength)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAccountName,
                $"Account name must contain between 1 and {MaxNameLength} characters.");
        }

        return normalized;
    }
}

public sealed record AccountOpening(
    Account Account,
    FinancialTransaction? OpeningBalance);