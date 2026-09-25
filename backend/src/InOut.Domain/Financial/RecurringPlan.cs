using InOut.Domain.Utils;

namespace InOut.Domain.Financial;

public enum RecurringPlanStatus { Active, Paused, Archived }

public sealed record RecurringPlan(
    Guid Id, Guid HouseholdId, string Name, FinancialFlow Flow,
    Guid AccountId, Guid CategoryId, Guid? IncomeSourceId,
    Money Amount, int DayOfMonth, DateOnly StartsOn, DateOnly? EndsOn,
    RecurringPlanStatus Status)
{
    public static RecurringPlan Create(
        Guid id, Guid householdId, string? name, FinancialFlow flow,
        Guid accountId, Guid categoryId, Guid? incomeSourceId,
        long amountCents, string currency, int dayOfMonth,
        DateOnly startsOn, DateOnly? endsOn)
    {
        var normalized = StringUtils.TrimToNull(name);
        if (id == Guid.Empty || householdId == Guid.Empty || accountId == Guid.Empty ||
            categoryId == Guid.Empty || normalized is null || normalized.Length > 120 ||
            !Enum.IsDefined(flow) || dayOfMonth is < 1 or > 31 ||
            (endsOn is not null && endsOn < startsOn) ||
            (flow != FinancialFlow.Income && incomeSourceId is not null) ||
            incomeSourceId == Guid.Empty)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidRecurringPlan,
                "Recurring plan fields or monthly schedule are invalid.");

        return new RecurringPlan(id, householdId, normalized, flow, accountId,
            categoryId, incomeSourceId, Money.Positive(amountCents, currency),
            dayOfMonth, startsOn, endsOn, RecurringPlanStatus.Active);
    }

    public RecurringPlan ChangeStatus(RecurringPlanStatus status)
    {
        if (status is not (RecurringPlanStatus.Active or RecurringPlanStatus.Paused or RecurringPlanStatus.Archived) ||
            Status == RecurringPlanStatus.Archived && status != RecurringPlanStatus.Archived)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidRecurringPlan,
                "An archived plan cannot be reactivated.");
        return this with { Status = status };
    }

    public void ValidateReferences(Account? account, Category? category, IncomeSource? source)
    {
        if (account is null || account.HouseholdId != HouseholdId || !account.IsActive ||
            account.Id != AccountId || account.Currency != Amount.Currency ||
            category is null || category.HouseholdId != HouseholdId || !category.IsActive ||
            category.Id != CategoryId || category.Flow != Flow ||
            IncomeSourceId is not null && (source is null || source.Id != IncomeSourceId ||
                source.HouseholdId != HouseholdId || !source.IsActive))
            throw new FinancialRuleException(FinancialErrorCodes.InvalidRecurringPlan,
                "Plan references must be active and belong to the same household.");
    }

    public IReadOnlyList<DateOnly> NextDates(DateOnly from, int count)
    {
        if (count is < 1 or > 24)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidRecurringPlan,
                "Preview count must be between 1 and 24.");
        if (Status != RecurringPlanStatus.Active) return [];

        var dates = new List<DateOnly>(count);
        var cursor = new DateOnly(Math.Max(from.Year, StartsOn.Year),
            Math.Max(from.Year, StartsOn.Year) == from.Year ? from.Month : StartsOn.Month, 1);
        if (cursor < new DateOnly(StartsOn.Year, StartsOn.Month, 1))
            cursor = new DateOnly(StartsOn.Year, StartsOn.Month, 1);
        for (var i = 0; i < count + 1 && dates.Count < count; i++)
        {
            var date = new DateOnly(cursor.Year, cursor.Month,
                Math.Min(DayOfMonth, DateTime.DaysInMonth(cursor.Year, cursor.Month)));
            if (date >= from && date >= StartsOn && (EndsOn is null || date <= EndsOn))
                dates.Add(date);
            if (EndsOn is not null && cursor > EndsOn.Value) break;
            if (cursor.Year == 9999 && cursor.Month == 12) break;
            cursor = cursor.AddMonths(1);
        }
        return dates;
    }
}
