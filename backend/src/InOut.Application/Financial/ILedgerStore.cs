using InOut.Application.Idempotency;
using InOut.Domain.Financial;

namespace InOut.Application.Financial;

public interface ILedgerStore
{
    Task<AccountCreationResult> CreateAccountAsync(
        AccountOpening opening,
        IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<AccountSummary>> GetAccountsAsync(
        Guid householdId,
        bool includeArchived,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<CategorySummary>> GetCategoriesAsync(
        Guid householdId,
        FinancialFlow? flow,
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
        IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken);

    Task<LedgerWriteResult> ReverseAsync(
        Guid householdId,
        Guid transactionId,
        DateOnly occurredOn,
        string? description,
        IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<AccountBalance>> GetBalancesAsync(
        Guid householdId,
        CancellationToken cancellationToken);

    Task<LedgerReconciliation> ReconcileAsync(
        Guid householdId,
        CancellationToken cancellationToken);
}
