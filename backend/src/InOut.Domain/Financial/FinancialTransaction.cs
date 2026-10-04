using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public sealed class FinancialTransaction
{
    private readonly IReadOnlyList<LedgerEntry> entries;

    private FinancialTransaction(
        Guid id,
        Guid householdId,
        FinancialTransactionKind kind,
        string? description,
        DateOnly occurredOn,
        Guid createdBy,
        Guid? reversalOf,
        FinancialTransactionStatus status,
        IReadOnlyList<LedgerEntry> entries,
        Guid? incomeSourceId = null)
    {
        if (incomeSourceId is not null && (kind != FinancialTransactionKind.Income || incomeSourceId == Guid.Empty))
            throw new FinancialRuleException(FinancialErrorCodes.InvalidIncomeSource, "Only income may have an income source.");
        IncomeSourceId = incomeSourceId;
        if (entries.Count == 0)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.TransactionWithoutEntries,
                "A financial transaction must have at least one entry.");
        }

        if (entries.Select(entry => entry.Amount.Currency).Distinct().Count() != 1)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.CurrencyMismatch,
                "Every entry in a transaction must use the same currency.");
        }

        Id = id;
        HouseholdId = householdId;
        Kind = kind;
        Description = NormalizeDescription(description);
        OccurredOn = occurredOn;
        CreatedBy = createdBy;
        ReversalOf = reversalOf;
        Status = status;
        this.entries = entries;
    }

    public Guid Id { get; }

    public Guid HouseholdId { get; }

    public FinancialTransactionKind Kind { get; }

    public string? Description { get; }

    public DateOnly OccurredOn { get; }

    public Guid CreatedBy { get; }

    public Guid? ReversalOf { get; }

    public Guid? IncomeSourceId { get; }

    public FinancialTransactionStatus Status { get; }

    public IReadOnlyList<LedgerEntry> Entries => entries;

    public static FinancialTransaction Income(
        Guid householdId,
        Guid accountId,
        Guid categoryId,
        Money amount,
        DateOnly occurredOn,
        Guid actorUserId,
        string? description,
        Guid? incomeSourceId = null) =>
        SingleEntry(
            householdId,
            FinancialTransactionKind.Income,
            accountId,
            categoryId,
            EntryDirection.Credit,
            amount,
            occurredOn,
            actorUserId,
            description,
            incomeSourceId);

    public static FinancialTransaction OpeningBalance(
        Guid householdId,
        Guid accountId,
        Money amount,
        DateOnly occurredOn,
        Guid actorUserId) =>
        SingleEntry(
            householdId,
            FinancialTransactionKind.OpeningBalance,
            accountId,
            null,
            EntryDirection.Credit,
            amount,
            occurredOn,
            actorUserId,
            "Saldo inicial");

    public static FinancialTransaction Expense(
        Guid householdId,
        Guid accountId,
        Guid categoryId,
        Money amount,
        DateOnly occurredOn,
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
            actorUserId,
            description);

    public static FinancialTransaction Transfer(
        Guid householdId,
        Guid sourceAccountId,
        Guid destinationAccountId,
        Money amount,
        DateOnly occurredOn,
        Guid actorUserId,
        string? description)
    {
        if (sourceAccountId == destinationAccountId)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.SameTransferAccount,
                "Source and destination accounts must differ.");
        }

        var positiveAmount = Money.Positive(amount.Cents, amount.Currency);
        return new FinancialTransaction(
            Guid.NewGuid(),
            householdId,
            FinancialTransactionKind.Transfer,
            description,
            occurredOn,
            actorUserId,
            null,
            FinancialTransactionStatus.Posted,
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
        Guid actorUserId,
        DateOnly occurredOn,
        string? description = null)
    {
        if (postedTransaction.Status is not FinancialTransactionStatus.Posted)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.TransactionNotReversible,
                "Only a posted transaction can be reversed.");
        }

        if (postedTransaction.Kind is FinancialTransactionKind.Reversal)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.ReversalOfReversal,
                "A reversal cannot reverse another reversal.");
        }

        return new FinancialTransaction(
            Guid.NewGuid(),
            postedTransaction.HouseholdId,
            FinancialTransactionKind.Reversal,
            description ?? $"Reversal of {postedTransaction.Id}",
            occurredOn,
            actorUserId,
            postedTransaction.Id,
            FinancialTransactionStatus.Posted,
            postedTransaction.Entries.Select(entry => entry.Reverse()).ToArray());
    }

    public static FinancialTransaction RestorePosted(
        Guid id,
        Guid householdId,
        FinancialTransactionKind kind,
        string? description,
        DateOnly occurredOn,
        Guid createdBy,
        Guid? reversalOf,
        FinancialTransactionStatus status,
        IReadOnlyList<LedgerEntry> entries,
        Guid? incomeSourceId = null) =>
        new(
            id,
            householdId,
            kind,
            description,
            occurredOn,
            createdBy,
            reversalOf,
            status,
            entries,
            incomeSourceId);

    public void ValidateReferences(
        IReadOnlyCollection<Account> accounts,
        IReadOnlyCollection<Category> categories)
    {
        var accountIds = entries.Select(entry => entry.AccountId).Distinct().ToArray();
        var referencedAccounts = accounts
            .Where(account => accountIds.Contains(account.Id))
            .ToArray();
        if (referencedAccounts.Length != accountIds.Length ||
            referencedAccounts.Any(account => account.HouseholdId != HouseholdId || !account.IsActive))
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidAccount,
                "Every account must be active and belong to the household.");
        }

        if (referencedAccounts.Any(account =>
            !string.Equals(account.Currency, entries[0].Amount.Currency, StringComparison.Ordinal)))
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.CurrencyMismatch,
                "Transaction currency must match every account.");
        }

        var categoryIds = entries
            .Where(entry => entry.CategoryId is not null)
            .Select(entry => entry.CategoryId!.Value)
            .Distinct()
            .ToArray();
        if (categoryIds.Length == 0)
        {
            return;
        }

        var expectedFlow = Kind switch
        {
            FinancialTransactionKind.Income => FinancialFlow.Income,
            FinancialTransactionKind.Expense => FinancialFlow.Expense,
            _ => throw new FinancialRuleException(
                FinancialErrorCodes.InvalidCategory,
                "This transaction kind cannot have a category."),
        };
        var referencedCategories = categories
            .Where(category => categoryIds.Contains(category.Id))
            .ToArray();
        if (referencedCategories.Length != categoryIds.Length ||
            referencedCategories.Any(category =>
                category.HouseholdId != HouseholdId ||
                !category.IsActive ||
                category.Flow != expectedFlow))
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidCategory,
                "Every category must be active, belong to the household, and match the transaction flow.");
        }
    }

    public FinancialTransaction CorrectClassification(
        Category? newCategory,
        IncomeSource? newIncomeSource,
        string? newDescription)
    {
        if (Status == FinancialTransactionStatus.Reversed || ReversalOf is not null || Kind == FinancialTransactionKind.Reversal)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidTransactionState,
                "Reversed transactions cannot have their classification corrected.");
        }

        Guid? targetCategoryId = entries.Count > 0 ? entries[0].CategoryId : null;
        if (newCategory is not null)
        {
            if (newCategory.HouseholdId != HouseholdId || !newCategory.IsActive)
            {
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidCategory,
                    "Category must belong to the household.");
            }

            var expectedFlow = Kind switch
            {
                FinancialTransactionKind.Income => FinancialFlow.Income,
                FinancialTransactionKind.Expense => FinancialFlow.Expense,
                _ => (FinancialFlow?)null
            };

            if (expectedFlow is not null && newCategory.Flow != expectedFlow.Value)
            {
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidCategory,
                    $"Category flow '{newCategory.Flow}' does not match transaction kind '{Kind}'.");
            }

            targetCategoryId = newCategory.Id;
        }

        Guid? targetIncomeSourceId = IncomeSourceId;
        if (newIncomeSource is not null)
        {
            if (Kind != FinancialTransactionKind.Income)
            {
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidIncomeSource,
                    "Income source can only be assigned to income transactions.");
            }

            if (newIncomeSource.HouseholdId != HouseholdId || !newIncomeSource.IsActive)
            {
                throw new FinancialRuleException(
                    FinancialErrorCodes.InvalidIncomeSource,
                    "Income source must belong to the household.");
            }

            targetIncomeSourceId = newIncomeSource.Id;
        }

        var updatedEntries = entries.Select(entry => new LedgerEntry(
            entry.Id,
            entry.AccountId,
            targetCategoryId,
            entry.Direction,
            entry.Amount)).ToArray();

        return new FinancialTransaction(
            Id,
            HouseholdId,
            Kind,
            newDescription,
            OccurredOn,
            CreatedBy,
            ReversalOf,
            Status,
            updatedEntries,
            targetIncomeSourceId);
    }

    private static FinancialTransaction SingleEntry(
        Guid householdId,
        FinancialTransactionKind kind,
        Guid accountId,
        Guid? categoryId,
        EntryDirection direction,
        Money amount,
        DateOnly occurredOn,
        Guid actorUserId,
        string? description,
        Guid? incomeSourceId = null) =>
        new(
            Guid.NewGuid(),
            householdId,
            kind,
            description,
            occurredOn,
            actorUserId,
            null,
            FinancialTransactionStatus.Posted,
            [
                new LedgerEntry(
                    Guid.NewGuid(),
                    accountId,
                    categoryId,
                    direction,
                    Money.Positive(amount.Cents, amount.Currency)),
            ],
            incomeSourceId);

    private static string? NormalizeDescription(string? description)
    {
        var normalized = StringUtils.TrimToNull(description);
        if (normalized?.Length > 500)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.DescriptionTooLong,
                "Description cannot exceed 500 characters.");
        }

        return normalized;
    }
}
