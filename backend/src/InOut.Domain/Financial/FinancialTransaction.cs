namespace InOut.Domain.Financial;

public enum FinancialTransactionKind
{
    OpeningBalance,
    Income,
    Expense,
    Transfer,
    Reversal
}

public sealed class FinancialTransaction
{
    private readonly IReadOnlyList<LedgerEntry> entries;

    private FinancialTransaction(
        Guid id,
        Guid householdId,
        FinancialTransactionKind kind,
        string? description,
        DateOnly occurredOn,
        Guid idempotencyKey,
        Guid createdBy,
        Guid? reversalOf,
        IReadOnlyList<LedgerEntry> entries)
    {
        if (idempotencyKey == Guid.Empty)
        {
            throw new FinancialRuleException(
                "invalid_idempotency_key",
                "Idempotency key is required.");
        }

        Id = id;
        HouseholdId = householdId;
        Kind = kind;
        Description = NormalizeDescription(description);
        OccurredOn = occurredOn;
        IdempotencyKey = idempotencyKey;
        CreatedBy = createdBy;
        ReversalOf = reversalOf;
        this.entries = entries;
    }

    public Guid Id { get; }

    public Guid HouseholdId { get; }

    public FinancialTransactionKind Kind { get; }

    public string? Description { get; }

    public DateOnly OccurredOn { get; }

    public Guid IdempotencyKey { get; }

    public Guid CreatedBy { get; }

    public Guid? ReversalOf { get; }

    public IReadOnlyList<LedgerEntry> Entries => entries;

    public static FinancialTransaction Income(
        Guid householdId,
        Guid accountId,
        Guid categoryId,
        Money amount,
        DateOnly occurredOn,
        Guid idempotencyKey,
        Guid actorUserId,
        string? description) =>
        SingleEntry(
            householdId,
            FinancialTransactionKind.Income,
            accountId,
            categoryId,
            EntryDirection.Credit,
            amount,
            occurredOn,
            idempotencyKey,
            actorUserId,
            description);

    public static FinancialTransaction OpeningBalance(
        Guid householdId,
        Guid accountId,
        Money amount,
        DateOnly occurredOn,
        Guid idempotencyKey,
        Guid actorUserId) =>
        SingleEntry(
            householdId,
            FinancialTransactionKind.OpeningBalance,
            accountId,
            null,
            EntryDirection.Credit,
            amount,
            occurredOn,
            idempotencyKey,
            actorUserId,
            "Saldo inicial");

    public static FinancialTransaction Expense(
        Guid householdId,
        Guid accountId,
        Guid categoryId,
        Money amount,
        DateOnly occurredOn,
        Guid idempotencyKey,
        Guid actorUserId,
        string? description) =>
        SingleEntry(
            householdId,
            FinancialTransactionKind.Expense,
            accountId,
            categoryId,
            EntryDirection.Debit,
            amount,
            occurredOn,
            idempotencyKey,
            actorUserId,
            description);

    public static FinancialTransaction Transfer(
        Guid householdId,
        Guid sourceAccountId,
        Guid destinationAccountId,
        Money amount,
        DateOnly occurredOn,
        Guid idempotencyKey,
        Guid actorUserId,
        string? description)
    {
        if (sourceAccountId == destinationAccountId)
        {
            throw new FinancialRuleException(
                "same_transfer_account",
                "Source and destination accounts must differ.");
        }

        var positiveAmount = Money.Positive(amount.Cents, amount.Currency);
        return new FinancialTransaction(
            Guid.NewGuid(),
            householdId,
            FinancialTransactionKind.Transfer,
            description,
            occurredOn,
            idempotencyKey,
            actorUserId,
            null,
            [
                new LedgerEntry(
                    Guid.NewGuid(),
                    sourceAccountId,
                    null,
                    EntryDirection.Debit,
                    positiveAmount),
                new LedgerEntry(
                    Guid.NewGuid(),
                    destinationAccountId,
                    null,
                    EntryDirection.Credit,
                    positiveAmount),
            ]);
    }

    public static FinancialTransaction Reversal(
        FinancialTransaction postedTransaction,
        Guid idempotencyKey,
        Guid actorUserId,
        DateOnly occurredOn,
        string? description = null)
    {
        if (postedTransaction.Kind is FinancialTransactionKind.Reversal)
        {
            throw new FinancialRuleException(
                "reversal_of_reversal",
                "A reversal cannot reverse another reversal.");
        }

        return new FinancialTransaction(
            Guid.NewGuid(),
            postedTransaction.HouseholdId,
            FinancialTransactionKind.Reversal,
            description ?? $"Reversal of {postedTransaction.Id}",
            occurredOn,
            idempotencyKey,
            actorUserId,
            postedTransaction.Id,
            postedTransaction.Entries.Select(entry => entry.Reverse()).ToArray());
    }

    public static FinancialTransaction RestorePosted(
        Guid id,
        Guid householdId,
        FinancialTransactionKind kind,
        string? description,
        DateOnly occurredOn,
        Guid idempotencyKey,
        Guid createdBy,
        Guid? reversalOf,
        IReadOnlyList<LedgerEntry> entries) =>
        new(
            id,
            householdId,
            kind,
            description,
            occurredOn,
            idempotencyKey,
            createdBy,
            reversalOf,
            entries);

    private static FinancialTransaction SingleEntry(
        Guid householdId,
        FinancialTransactionKind kind,
        Guid accountId,
        Guid? categoryId,
        EntryDirection direction,
        Money amount,
        DateOnly occurredOn,
        Guid idempotencyKey,
        Guid actorUserId,
        string? description) =>
        new(
            Guid.NewGuid(),
            householdId,
            kind,
            description,
            occurredOn,
            idempotencyKey,
            actorUserId,
            null,
            [
                new LedgerEntry(
                    Guid.NewGuid(),
                    accountId,
                    categoryId,
                    direction,
                    Money.Positive(amount.Cents, amount.Currency)),
            ]);

    private static string? NormalizeDescription(string? description)
    {
        var normalized = description?.Trim();
        if (normalized?.Length > 500)
        {
            throw new FinancialRuleException(
                "description_too_long",
                "Description cannot exceed 500 characters.");
        }

        return string.IsNullOrEmpty(normalized) ? null : normalized;
    }
}
