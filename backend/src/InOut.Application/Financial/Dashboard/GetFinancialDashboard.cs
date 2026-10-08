using InOut.Application.Security;
using InOut.Domain.Financial;
using InOut.Domain.Households;

namespace InOut.Application.Financial.Dashboard;

public sealed record GetFinancialDashboardQuery(
    Guid ActorUserId,
    Guid HouseholdId,
    int? Year = null,
    int? Month = null,
    DateOnly? From = null,
    DateOnly? To = null);

public sealed class GetFinancialDashboard(
    IHouseholdMembershipReader membershipReader,
    IDashboardReader dashboardReader)
{
    public async Task<FinancialDashboard> ExecuteAsync(
        GetFinancialDashboardQuery query,
        CancellationToken cancellationToken)
    {
        FinancialPeriod period;
        if (query.From is not null && query.To is not null)
        {
            period = FinancialPeriod.Custom(query.From.Value, query.To.Value);
        }
        else if (query.Year is not null && query.Month is not null)
        {
            period = FinancialPeriod.Monthly(query.Year.Value, query.Month.Value);
        }
        else
        {
            var now = DateTime.UtcNow;
            period = FinancialPeriod.Monthly(now.Year, now.Month);
        }
        if (!await membershipReader.IsMemberAsync(
                query.ActorUserId,
                query.HouseholdId,
                cancellationToken))
        {
            throw new HouseholdRuleException(
                HouseholdErrorCodes.MembershipRequired,
                "The user is not a member of this household.");
        }

        var source = await dashboardReader.ReadAsync(
            query.ActorUserId,
            query.HouseholdId,
            period,
            cancellationToken);
        var totals = FinancialDashboardCalculator.Calculate(
            source.Accounts.Select(account => new DashboardAccountSnapshot(
                account.Id,
                account.Currency,
                account.BalanceCents)).ToArray(),
            source.Postings);
        var categories = source.Categories.ToDictionary(category => category.Id);
        var categoryExpenses = totals.Categories
            .Where(total => categories.ContainsKey(total.CategoryId))
            .Select(total =>
            {
                var category = categories[total.CategoryId];
                return new DashboardCategoryExpense(
                    category.Id,
                    category.Name,
                    category.ParentId,
                    total.Currency,
                    total.AmountCents);
            })
            .ToArray();

        var activitiesByAccount = totals.AccountActivities.ToDictionary(a => a.AccountId);
        var incomeSourcesMap = source.IncomeSources.ToDictionary(s => s.Id, s => s.Name);
        var incomeSourceIncomes = totals.IncomeSources
            .Select(total => new DashboardIncomeSourceIncome(
                total.IncomeSourceId,
                total.IncomeSourceId is { } srcId && incomeSourcesMap.TryGetValue(srcId, out var srcName)
                    ? srcName
                    : "Sem fonte definida",
                total.Currency,
                total.AmountCents))
            .ToArray();

        return new FinancialDashboard(
            period.Start,
            period.End,
            source.PostedTransactionCount == source.EntryTransactionCount,
            totals.Currencies.Select(total => new DashboardCurrencySummary(
                total.Currency,
                total.ConsolidatedBalanceCents,
                total.IncomeCents,
                total.ExpenseCents,
                total.ResultCents)).ToArray(),
            source.Accounts.Select(account =>
            {
                activitiesByAccount.TryGetValue(account.Id, out var activity);
                return new DashboardAccountBalance(
                    account.Id,
                    account.Name,
                    account.Currency,
                    account.BalanceCents,
                    activity?.InflowCents ?? 0,
                    activity?.OutflowCents ?? 0,
                    activity?.NetChangeCents ?? 0);
            }).ToArray(),
            categoryExpenses,
            incomeSourceIncomes,
            source.Budgets
                .Where(budget => categories.ContainsKey(budget.CategoryId))
                .Select(budget => new DashboardBudgetProgress(
                    budget.Id,
                    budget.CategoryId,
                    categories[budget.CategoryId].Name,
                    budget.LimitCents,
                    categoryExpenses.Where(expense => expense.CategoryId == budget.CategoryId)
                        .Sum(expense => expense.AmountCents)))
                .ToArray(),
            source.Goals.Select(goal => new DashboardGoalProgress(
                goal.Id,
                goal.Name,
                goal.TargetCents,
                goal.AllocatedCents,
                goal.TargetDate)).ToArray());
    }
}
