using InOut.Application.Financial.Dashboard;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed class EfDashboardReader(InOutDbContext dbContext) : IDashboardReader
{
    public async Task<DashboardSourceData> ReadAsync(
        Guid actorUserId,
        Guid householdId,
        FinancialPeriod period,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(
            actorUserId,
            cancellationToken);

        var accounts = await ReadAccountsAsync(householdId, period.End, cancellationToken);
        var categories = await ReadCategoriesAsync(householdId, cancellationToken);
        var postings = await ReadPostingsAsync(householdId, period, cancellationToken);
        var budgets = await ReadBudgetsAsync(householdId, period, cancellationToken);
        var goals = await ReadGoalsAsync(householdId, cancellationToken);
        var reconciliation = await ReadReconciliationAsync(householdId, cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return new DashboardSourceData(
            accounts,
            categories,
            postings,
            budgets,
            goals,
            reconciliation.PostedTransactionCount,
            reconciliation.EntryTransactionCount);
    }

    private async Task<IReadOnlyList<DashboardAccountSource>> ReadAccountsAsync(
        Guid householdId,
        DateOnly through,
        CancellationToken cancellationToken) =>
        await dbContext.Accounts.AsNoTracking()
            .Where(account => account.HouseholdId == householdId && account.ArchivedAt == null)
            .OrderBy(account => account.Name)
            .Select(account => new DashboardAccountSource(
                account.Id,
                account.Name,
                account.Currency,
                (from entry in dbContext.Entries
                 join transaction in dbContext.FinancialTransactions
                     on new { entry.HouseholdId, Id = entry.TransactionId }
                     equals new { transaction.HouseholdId, transaction.Id }
                 where entry.HouseholdId == householdId &&
                     entry.AccountId == account.Id &&
                     transaction.OccurredOn <= through
                 select (long?)(entry.Direction == EntryDirection.Credit
                     ? entry.AmountCents
                     : -entry.AmountCents)).Sum() ?? 0))
            .ToArrayAsync(cancellationToken);

    private async Task<IReadOnlyList<DashboardCategorySource>> ReadCategoriesAsync(
        Guid householdId,
        CancellationToken cancellationToken) =>
        await dbContext.Categories.AsNoTracking()
            .Where(category => category.HouseholdId == householdId)
            .Select(category => new DashboardCategorySource(
                category.Id,
                category.Name,
                category.ParentId))
            .ToArrayAsync(cancellationToken);

    private async Task<IReadOnlyList<DashboardPosting>> ReadPostingsAsync(
        Guid householdId,
        FinancialPeriod period,
        CancellationToken cancellationToken)
    {
        var transactions = await dbContext.FinancialTransactions.AsNoTracking()
            .Include(transaction => transaction.Entries)
            .Where(transaction => transaction.HouseholdId == householdId &&
                transaction.OccurredOn >= period.Start && transaction.OccurredOn <= period.End)
            .ToArrayAsync(cancellationToken);
        var reversedIds = transactions
            .Where(transaction => transaction.ReversalOf is not null)
            .Select(transaction => transaction.ReversalOf!.Value)
            .Distinct()
            .ToArray();
        var reversedKinds = await dbContext.FinancialTransactions.AsNoTracking()
            .Where(transaction => transaction.HouseholdId == householdId && reversedIds.Contains(transaction.Id))
            .ToDictionaryAsync(transaction => transaction.Id, transaction => transaction.Kind, cancellationToken);

        return transactions.SelectMany(transaction => transaction.Entries.Select(entry =>
                new DashboardPosting(
                    entry.AccountId,
                    entry.CategoryId,
                    transaction.Kind,
                    transaction.ReversalOf is { } reversalOf && reversedKinds.TryGetValue(reversalOf, out var kind)
                        ? kind
                        : null,
                    entry.AmountCents)))
            .ToArray();
    }

    private async Task<IReadOnlyList<DashboardBudgetSource>> ReadBudgetsAsync(
        Guid householdId,
        FinancialPeriod period,
        CancellationToken cancellationToken) =>
        await dbContext.Budgets.AsNoTracking()
            .Where(budget => budget.HouseholdId == householdId &&
                budget.PeriodStart == period.Start && budget.PeriodEnd == period.End)
            .Select(budget => new DashboardBudgetSource(
                budget.Id,
                budget.CategoryId,
                budget.LimitCents))
            .ToArrayAsync(cancellationToken);

    private async Task<IReadOnlyList<DashboardGoalSource>> ReadGoalsAsync(
        Guid householdId,
        CancellationToken cancellationToken) =>
        await dbContext.Goals.AsNoTracking()
            .Where(goal => goal.HouseholdId == householdId && goal.ArchivedAt == null)
            .OrderBy(goal => goal.TargetDate)
            .Select(goal => new DashboardGoalSource(
                goal.Id,
                goal.Name,
                goal.TargetCents,
                goal.AllocatedCents,
                goal.TargetDate))
            .ToArrayAsync(cancellationToken);

    private async Task<ReconciliationCounts> ReadReconciliationAsync(
        Guid householdId,
        CancellationToken cancellationToken)
    {
        var posted = await dbContext.FinancialTransactions.AsNoTracking()
            .LongCountAsync(transaction => transaction.HouseholdId == householdId &&
                (transaction.Status == FinancialTransactionStatus.Posted ||
                    transaction.Status == FinancialTransactionStatus.Reversed), cancellationToken);
        var withEntries = await dbContext.Entries.AsNoTracking()
            .Where(entry => entry.HouseholdId == householdId)
            .Select(entry => entry.TransactionId)
            .Distinct()
            .LongCountAsync(cancellationToken);
        return new ReconciliationCounts(posted, withEntries);
    }

    private sealed record ReconciliationCounts(
        long PostedTransactionCount,
        long EntryTransactionCount);
}
