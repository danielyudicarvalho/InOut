using InOut.Domain.Financial;

namespace InOut.Application.Financial;

public sealed record LedgerWriteResult(Guid TransactionId, bool Replayed);

public sealed record AccountBalance(Guid AccountId, string Currency, long BalanceCents);

public sealed record AccountSummary(
    Guid Id,
    string Name,
    AccountKind Kind,
    string Currency,
    long BalanceCents,
    DateTimeOffset? ArchivedAt);

public sealed record AccountCreationResult(AccountSummary Account, bool Replayed);

public sealed record CategorySummary(Guid Id, string Name, FinancialFlow Flow);

public sealed record LedgerHistoryItem(
    Guid TransactionId,
    FinancialTransactionKind Kind,
    FinancialTransactionStatus Status,
    string? Description,
    Guid? ReversalOf,
    DateOnly OccurredOn,
    DateTimeOffset PostedAt,
    Guid CreatedBy,
    Guid AccountId,
    string AccountName,
    EntryDirection Direction,
    long AmountCents,
    string Currency);

public sealed record LedgerReconciliation(
    bool IsConsistent,
    long PostedTransactionCount,
    long EntryTransactionCount,
    IReadOnlyList<AccountBalance> Balances);
