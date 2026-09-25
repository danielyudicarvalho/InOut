namespace InOut.Domain.Financial;

public sealed record ForecastPoint(
    DateOnly Month, long ExpectedIncomeCents, long ExpectedExpenseCents,
    long ProjectedBalanceCents, IReadOnlyList<Guid> RecurringPlanIds);

public static class Forecast
{
    public static IReadOnlyList<ForecastPoint> Project(
        DateOnly asOf, int months, long openingBalanceCents,
        IEnumerable<RecurringPlan> recurringPlans)
    {
        if (months is < 1 or > 12 || asOf.Year > 9998)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidForecast,
                "Forecast horizon must be between one and twelve months.");

        var plans = recurringPlans.ToArray();
        var points = new List<ForecastPoint>(months);
        var balance = openingBalanceCents;
        var month = new DateOnly(asOf.Year, asOf.Month, 1);
        for (var index = 0; index < months; index++)
        {
            var nextMonth = month.AddMonths(1);
            var from = index == 0 ? asOf : month;
            long income = 0;
            long expense = 0;
            var contributing = new List<Guid>();
            foreach (var plan in plans)
            {
                if (plan.Status != RecurringPlanStatus.Active) continue;
                var dates = plan.NextDates(from, 1);
                if (dates.Count == 0 || dates[0] >= nextMonth) continue;
                if (plan.Flow == FinancialFlow.Income)
                    income = checked(income + plan.Amount.Cents);
                else
                    expense = checked(expense + plan.Amount.Cents);
                contributing.Add(plan.Id);
            }
            balance = checked(checked(balance + income) - expense);
            points.Add(new ForecastPoint(month, income, expense, balance, contributing));
            month = nextMonth;
        }
        return points;
    }
}
