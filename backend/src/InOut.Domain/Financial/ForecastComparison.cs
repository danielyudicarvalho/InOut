namespace InOut.Domain.Financial;

public sealed record ForecastMonthActual(DateOnly Month, long IncomeCents, long ExpenseCents);

public sealed record ForecastComparisonPoint(
    DateOnly Month,
    long ExpectedIncomeCents, long ExpectedExpenseCents, long ProjectedBalanceCents,
    long ActualIncomeCents, long ActualExpenseCents);

public static class ForecastComparison
{
    public static ForecastMonthActual Actual(DateOnly month, Guid accountId, IEnumerable<DashboardPosting> postings)
    {
        var start = new DateOnly(month.Year, month.Month, 1);
        var end = start.AddMonths(1).AddDays(-1);
        long income = 0;
        long expense = 0;
        foreach (var posting in postings)
        {
            if (posting.AccountId != accountId || posting.OccurredOn < start || posting.OccurredOn > end)
                continue;
            if (FinancialDashboardCalculator.IncomeContribution(posting) is { } received)
                income = checked(income + received);
            if (FinancialDashboardCalculator.ExpenseContribution(posting) is { } spent)
                expense = checked(expense + spent);
        }
        return new ForecastMonthActual(start, income, expense);
    }

    public static IReadOnlyList<ForecastComparisonPoint> Compare(
        IReadOnlyList<ForecastPoint> points, IReadOnlyList<ForecastMonthActual> actuals)
    {
        var byMonth = actuals.ToDictionary(item => item.Month);
        return points.Select(point =>
        {
            byMonth.TryGetValue(point.Month, out var actual);
            return new ForecastComparisonPoint(
                point.Month, point.ExpectedIncomeCents, point.ExpectedExpenseCents, point.ProjectedBalanceCents,
                actual?.IncomeCents ?? 0, actual?.ExpenseCents ?? 0);
        }).ToArray();
    }
}
