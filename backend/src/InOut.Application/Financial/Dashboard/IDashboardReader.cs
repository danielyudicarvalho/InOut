using InOut.Domain.Financial;

namespace InOut.Application.Financial.Dashboard;

public interface IDashboardReader
{
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
    long PostedTransactionCount,
    long EntryTransactionCount);

public sealed record DashboardAccountSource(
    Guid Id,
    string Name,
    string Currency,
    long BalanceCents);

public sealed record DashboardCategorySource(Guid Id, string Name, Guid? ParentId);

public sealed record DashboardBudgetSource(Guid Id, Guid CategoryId, long LimitCents);

public sealed record DashboardGoalSource(
    Guid Id,
    string Name,
    long TargetCents,
    long AllocatedCents,
    DateOnly? TargetDate);
