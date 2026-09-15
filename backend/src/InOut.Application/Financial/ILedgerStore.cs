using InOut.Domain.Financial;

namespace InOut.Application.Financial;

public sealed record LedgerWriteResult(Guid TransactionId, bool Replayed);

public sealed record AccountBalance(Guid AccountId, string Currency, long BalanceCents);

public sealed record LedgerReconciliation(
    bool IsConsistent,
    long PostedTransactionCount,
    long EntryTransactionCount,
    IReadOnlyList<AccountBalance> Balances);

public interface ILedgerStore
{
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
