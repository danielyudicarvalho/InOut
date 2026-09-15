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

public sealed record LedgerHistoryItem(
    Guid TransactionId,
    FinancialTransactionKind Kind,
    string Status,
    string? Description,
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

public interface ILedgerStore
{
    Task<AccountCreationResult> CreateAccountAsync(
        Account account,
        long initialBalanceCents,
        DateOnly occurredOn,
        Guid idempotencyKey,
        Guid actorUserId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<AccountSummary>> GetAccountsAsync(
        Guid householdId,
        bool includeArchived,
        CancellationToken cancellationToken);

    Task ArchiveAccountAsync(
        Guid householdId,
        Guid accountId,
        Guid actorUserId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<LedgerHistoryItem>> GetHistoryAsync(
        Guid householdId,
        int limit,
        CancellationToken cancellationToken);

    Task<LedgerWriteResult> PostAsync(
        FinancialTransaction transaction,
        CancellationToken cancellationToken);

    Task<LedgerWriteResult> ReverseAsync(
        Guid householdId,
        Guid transactionId,
        Guid idempotencyKey,
        Guid actorUserId,
        DateOnly occurredOn,
        string? description,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<AccountBalance>> GetBalancesAsync(
        Guid householdId,
        CancellationToken cancellationToken);

    Task<LedgerReconciliation> ReconcileAsync(
        Guid householdId,
        CancellationToken cancellationToken);
}
