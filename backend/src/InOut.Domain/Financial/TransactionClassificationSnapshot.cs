namespace InOut.Domain.Financial;

public sealed record TransactionClassificationSnapshot(
    FinancialTransactionStatus Status,
    Guid? CategoryId,
    Guid? IncomeSourceId,
    string? Description);
