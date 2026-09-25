using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class RecurringPlanTests
{
    [Fact]
    public void MonthlyScheduleClampsToLastDayAndDoesNotCreateFinancialFact()
    {
        var plan = NewPlan(31, new DateOnly(2026, 1, 1));
        Assert.Equal(new[] {
            new DateOnly(2026, 1, 31),
            new DateOnly(2026, 2, 28),
            new DateOnly(2026, 3, 31),
        }, plan.NextDates(new DateOnly(2026, 1, 1), 3));
        Assert.Equal(RecurringPlanStatus.Active, plan.Status);
    }

    [Fact]
    public void ScheduleRespectsStartAndEndDates()
    {
        var plan = RecurringPlan.Create(Guid.NewGuid(), Guid.NewGuid(), "Rent",
            FinancialFlow.Expense, Guid.NewGuid(), Guid.NewGuid(), null,
            180000, "BRL", 5, new DateOnly(2026, 1, 10), new DateOnly(2026, 3, 6));
        Assert.Equal(new[] { new DateOnly(2026, 2, 5), new DateOnly(2026, 3, 5) },
            plan.NextDates(new DateOnly(2026, 1, 1), 5));
    }

    [Fact]
    public void PausedPlanHasNoUpcomingDatesAndArchivedPlanCannotResume()
    {
        var plan = NewPlan(5, new DateOnly(2026, 1, 1));
        Assert.Empty(plan.ChangeStatus(RecurringPlanStatus.Paused)
            .NextDates(new DateOnly(2026, 2, 1), 3));
        var archived = plan.ChangeStatus(RecurringPlanStatus.Archived);
        Assert.Throws<FinancialRuleException>(() => archived.ChangeStatus(RecurringPlanStatus.Active));
    }

    [Fact]
    public void RejectsCrossHouseholdOrArchivedReferences()
    {
        var plan = NewPlan(5, new DateOnly(2026, 1, 1));
        var account = Account.Create(Guid.NewGuid(), Guid.NewGuid(), "Checking", AccountKind.Checking, "BRL");
        Assert.Throws<FinancialRuleException>(() => plan.ValidateReferences(account, null, null));
    }

    [Fact]
    public void ExpenseCannotClaimAnIncomeSource()
    {
        var exception = Assert.Throws<FinancialRuleException>(() =>
            RecurringPlan.Create(Guid.NewGuid(), Guid.NewGuid(), "Rent",
                FinancialFlow.Expense, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
                180000, "BRL", 5, new DateOnly(2026, 1, 1), null));
        Assert.Equal(FinancialErrorCodes.InvalidRecurringPlan, exception.Code);
    }

    private static RecurringPlan NewPlan(int day, DateOnly startsOn) =>
        RecurringPlan.Create(Guid.NewGuid(), Guid.NewGuid(), "Rent", FinancialFlow.Expense,
            Guid.NewGuid(), Guid.NewGuid(), null, 180000, "BRL", day, startsOn, null);
}
