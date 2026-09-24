namespace InOut.Domain.Financial;

// Historical ledger fact. An entry can be absent for a draft transaction.
public sealed class FinancialExportRow
{
    private FinancialExportRow(
        Guid transactionId,
        FinancialTransactionKind kind,
        FinancialTransactionStatus status,
        DateOnly occurredOn,
        DateTimeOffset createdAt,
        DateTimeOffset? postedAt,
        string? description,
        Guid? reversalOf,
        Guid? openingAccountId,
        LedgerEntry? entry,
        string? accountName,
        string? categoryName,
        Guid? categoryParentId,
        FinancialFlow? categoryFlow)
    {
        TransactionId = transactionId;
        Kind = kind;
        Status = status;
        OccurredOn = occurredOn;
        CreatedAt = createdAt;
        PostedAt = postedAt;
        Description = description;
        ReversalOf = reversalOf;
        OpeningAccountId = openingAccountId;
        Entry = entry;
        AccountName = accountName;
        CategoryName = categoryName;
        CategoryParentId = categoryParentId;
        CategoryFlow = categoryFlow;
    }

    public Guid TransactionId { get; }
    public FinancialTransactionKind Kind { get; }
    public FinancialTransactionStatus Status { get; }
    public DateOnly OccurredOn { get; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset? PostedAt { get; }
    public string? Description { get; }
    public Guid? ReversalOf { get; }
    public Guid? OpeningAccountId { get; }
    public LedgerEntry? Entry { get; }
    public string? AccountName { get; }
    public string? CategoryName { get; }
    public Guid? CategoryParentId { get; }
    public FinancialFlow? CategoryFlow { get; }

    public static FinancialExportRow FromHistory(
        Guid transactionId,
        FinancialTransactionKind kind,
        FinancialTransactionStatus status,
        DateOnly occurredOn,
        DateTimeOffset createdAt,
        DateTimeOffset? postedAt,
        string? description,
        Guid? reversalOf,
        Guid? openingAccountId,
        LedgerEntry? entry,
        string? accountName,
        string? categoryName,
        Guid? categoryParentId,
        FinancialFlow? categoryFlow)
    {
        if ((kind is FinancialTransactionKind.Reversal) != (reversalOf is not null))
        {
            throw new InvalidOperationException("Historical reversal relationship is invalid.");
        }

        if (entry is not null && string.IsNullOrWhiteSpace(accountName))
        {
            throw new InvalidOperationException("Historical entry must identify its account.");
        }

        return new FinancialExportRow(transactionId, kind, status, occurredOn,
            createdAt, postedAt, description, reversalOf, openingAccountId,
            entry, accountName, categoryName, categoryParentId, categoryFlow);
    }
}
