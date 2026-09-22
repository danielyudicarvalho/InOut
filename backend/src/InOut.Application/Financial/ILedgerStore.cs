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
        bool includeArchived,
        CancellationToken cancellationToken);

    Task<CategorySummary> CreateCategoryAsync(
        Guid householdId, Guid actorUserId, Guid id, string name,
        FinancialFlow flow, Guid? parentId, IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken);

    Task ArchiveCategoryAsync(
        Guid householdId, Guid categoryId, Guid actorUserId, CancellationToken cancellationToken);

    Task ArchiveAccountAsync(
        Guid householdId,
        Guid accountId,
        Guid actorUserId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<LedgerHistoryItem>> GetHistoryAsync(
        Guid householdId,
        int limit,
        LedgerHistoryFilter filter,
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

    Task<FinancialDashboard> GetDashboardAsync(
        Guid householdId, DateOnly periodStart, DateOnly periodEnd,
        CancellationToken cancellationToken);
}
