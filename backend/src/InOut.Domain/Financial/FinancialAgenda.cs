namespace InOut.Domain.Financial;

public sealed record AgendaOccurrence(
    Guid Id, Guid PlanId, DateOnly ScheduledOn, Guid TransactionId,
    FinancialFlow Flow, long AmountCents, string Currency);

public sealed record AgendaItem(
    Guid PlanId, string PlanName, DateOnly ScheduledOn, FinancialFlow Flow,
    long AmountCents, string Currency, AgendaState State,
    Guid? OccurrenceId, Guid? TransactionId);

public static class FinancialAgenda
{
    public static IReadOnlyList<AgendaItem> Compose(
        IEnumerable<RecurringPlan> plans,
        IEnumerable<AgendaOccurrence> occurrences,
        DateOnly from, DateOnly to, DateOnly today)
    {
        if (to < from || to.DayNumber - from.DayNumber > 62)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidPeriod,
                "Agenda range must be between one and sixty-two days.");

        var planList = plans.ToArray();
        var occurrenceList = occurrences.ToArray();
        var byDate = occurrenceList.ToDictionary(item => (item.PlanId, item.ScheduledOn));
        var items = new List<AgendaItem>();
        var covered = new HashSet<(Guid, DateOnly)>();
        foreach (var plan in planList.Where(plan => plan.Status != RecurringPlanStatus.Archived))
        {
            var cursor = new DateOnly(from.Year, from.Month, 1);
            var end = new DateOnly(to.Year, to.Month, 1);
            while (cursor <= end)
            {
                var date = new DateOnly(cursor.Year, cursor.Month,
                    Math.Min(plan.DayOfMonth, DateTime.DaysInMonth(cursor.Year, cursor.Month)));
                if (date >= from && date <= to && plan.Produces(date))
                {
                    items.Add(Describe(plan, date, plan.Amount.Cents, plan.Amount.Currency, plan.Flow, byDate, today));
                    covered.Add((plan.Id, date));
                }
                if (cursor.Year == 9999 && cursor.Month == 12) break;
                cursor = cursor.AddMonths(1);
            }
        }

        foreach (var occurrence in occurrenceList)
        {
            if (occurrence.ScheduledOn < from || occurrence.ScheduledOn > to ||
                !covered.Add((occurrence.PlanId, occurrence.ScheduledOn)))
                continue;
            var plan = planList.FirstOrDefault(item => item.Id == occurrence.PlanId);
            items.Add(new AgendaItem(
                occurrence.PlanId, plan?.Name ?? "Plano", occurrence.ScheduledOn,
                occurrence.Flow, occurrence.AmountCents, occurrence.Currency,
                AgendaState.Realized, occurrence.Id, occurrence.TransactionId));
        }

        return items.OrderBy(item => item.ScheduledOn).ThenBy(item => item.PlanName, StringComparer.Ordinal).ToArray();
    }

    private static AgendaItem Describe(
        RecurringPlan plan, DateOnly date, long amountCents, string currency, FinancialFlow flow,
        Dictionary<(Guid PlanId, DateOnly ScheduledOn), AgendaOccurrence> byDate, DateOnly today)
    {
        if (byDate.TryGetValue((plan.Id, date), out var occurrence))
            return new AgendaItem(plan.Id, plan.Name, date, occurrence.Flow, occurrence.AmountCents,
                occurrence.Currency, AgendaState.Realized, occurrence.Id, occurrence.TransactionId);
        var state = date < today ? AgendaState.Overdue : AgendaState.Expected;
        return new AgendaItem(plan.Id, plan.Name, date, flow, amountCents, currency, state, null, null);
    }
}
