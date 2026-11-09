namespace InOut.Domain.Financial;

public sealed record ForecastPlanSnapshot(
    Guid PlanId, string Name, FinancialFlow Flow, Guid AccountId, Guid CategoryId,
    Guid? IncomeSourceId, long AmountCents, string Currency, int DayOfMonth,
    DateOnly StartsOn, DateOnly? EndsOn, RecurringPlanStatus Status)
{
    public static ForecastPlanSnapshot Capture(RecurringPlan plan) => new(
        plan.Id, plan.Name, plan.Flow, plan.AccountId, plan.CategoryId, plan.IncomeSourceId,
        plan.Amount.Cents, plan.Amount.Currency, plan.DayOfMonth, plan.StartsOn, plan.EndsOn, plan.Status);
}

public sealed record ForecastContribution(
    Guid PlanId, DateOnly ScheduledOn, FinancialFlow Flow, long AmountCents, string Currency);

public sealed record ForecastPoint(
    DateOnly Month, long ExpectedIncomeCents, long ExpectedExpenseCents,
    long ProjectedBalanceCents, IReadOnlyList<Guid> RecurringPlanIds,
    IReadOnlyList<ForecastContribution> Contributions);

public sealed record ForecastProjection(
    IReadOnlyList<ForecastPoint> Points, IReadOnlyList<ForecastPlanSnapshot> Assumptions);

public readonly record struct ForecastMovement(DateOnly OccurredOn, EntryDirection Direction, long AmountCents);

public static class Forecast
{
    public static long OpeningBalance(DateOnly asOf, IEnumerable<ForecastMovement> movements)
    {
        long balance = 0;
        foreach (var movement in movements)
        {
            if (movement.OccurredOn > asOf)
                continue;
            balance = checked(balance + (movement.Direction == EntryDirection.Credit
                ? movement.AmountCents
                : -movement.AmountCents));
        }
        return balance;
    }

    public static ForecastProjection Project(
        DateOnly asOf, int months, long openingBalanceCents,
        IEnumerable<RecurringPlan> recurringPlans)
    {
        if (months is < 1 or > 12 || asOf.Year > 9998)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidForecast,
                "Forecast horizon must be between one and twelve months.");

        var plans = recurringPlans.ToArray();
        var points = new List<ForecastPoint>(months);
        var assumptions = new List<ForecastPlanSnapshot>();
        var balance = openingBalanceCents;
        var month = new DateOnly(asOf.Year, asOf.Month, 1);
        for (var index = 0; index < months; index++)
        {
            var nextMonth = month.AddMonths(1);
            var from = index == 0 ? asOf : month;
            long income = 0;
            long expense = 0;
            var contributions = new List<ForecastContribution>();
            foreach (var plan in plans)
            {
                if (plan.Status != RecurringPlanStatus.Active) continue;
                var dates = plan.NextDates(from, 1);
                if (dates.Count == 0 || dates[0] >= nextMonth) continue;
                if (assumptions.All(item => item.PlanId != plan.Id))
                    assumptions.Add(ForecastPlanSnapshot.Capture(plan));
                var contribution = new ForecastContribution(
                    plan.Id, dates[0], plan.Flow, plan.Amount.Cents, plan.Amount.Currency);
                contributions.Add(contribution);
                if (plan.Flow == FinancialFlow.Income)
                    income = checked(income + contribution.AmountCents);
                else
                    expense = checked(expense + contribution.AmountCents);
            }
            balance = checked(checked(balance + income) - expense);
            points.Add(new ForecastPoint(
                month, income, expense, balance,
                contributions.Select(item => item.PlanId).ToArray(),
                contributions));
            month = nextMonth;
        }
        return new ForecastProjection(points, assumptions);
    }
}
