using InOut.Domain.Financial;

namespace InOut.Application.Financial.Dashboard;

public interface IDashboardReader
{
    // Historical income must keep accounts that were subsequently archived.
    Task<DashboardSourceData> ReadIncomeHistoryAsync(
        Guid actorUserId,
        Guid householdId,
        FinancialPeriod period,
        CancellationToken cancellationToken) =>
        ReadAsync(actorUserId, householdId, period, cancellationToken);

    Task<DashboardSourceData> ReadAsync(
        Guid actorUserId,
        Guid householdId,
        FinancialPeriod period,
        CancellationToken cancellationToken);
}

public sealed record DashboardSourceData(
    IReadOnlyList<DashboardAccountSource> Accounts,
    IReadOnlyList<DashboardCategorySource> Categories,
    IReadOnlyList<DashboardPosting> Postings,
    IReadOnlyList<DashboardBudgetSource> Budgets,
    IReadOnlyList<DashboardGoalSource> Goals,
    IReadOnlyList<DashboardIncomeSourceSource> IncomeSources,
    long PostedTransactionCount,
    long EntryTransactionCount,
    bool? HasFinancialActivity = null);

public sealed record DashboardAccountSource(
    Guid Id,
    string Name,
    string Currency,
    long BalanceCents,
    long? InitialBalanceCents = null);

public sealed record DashboardCategorySource(Guid Id, string Name, Guid? ParentId);

public sealed record DashboardIncomeSourceSource(Guid Id, string Name);

public sealed record DashboardBudgetSource(Guid Id, Guid CategoryId, long LimitCents);

public sealed record DashboardGoalSource(
    Guid Id,
    string Name,
    long TargetCents,
    long AllocatedCents,
    DateOnly? TargetDate);
