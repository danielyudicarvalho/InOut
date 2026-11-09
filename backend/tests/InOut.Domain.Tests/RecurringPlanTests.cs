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

    [Fact]
    public void RealizationPostsThePredictedDateOnceAndKeepsThatTransaction()
    {
        var actor = Guid.NewGuid();
        var realizedAt = new DateTimeOffset(2026, 2, 28, 12, 0, 0, TimeSpan.Zero);
        var plan = NewPlan(31, new DateOnly(2026, 1, 1));
        var first = plan.Realize(new DateOnly(2026, 2, 28), Guid.NewGuid(), actor, realizedAt, []);

        Assert.Equal(new DateOnly(2026, 2, 28), first.Occurrence.ScheduledOn);
        Assert.Equal(first.Transaction.Id, first.Occurrence.TransactionId);
        Assert.Equal(FinancialTransactionKind.Expense, first.Transaction.Kind);
        Assert.Equal(plan.Name, first.Transaction.Description);
        Assert.Equal(180000, first.Transaction.Entries.Single().Amount.Cents);
        Assert.Equal(EntryDirection.Debit, first.Transaction.Entries.Single().Direction);
        Assert.Equal(plan.AccountId, first.Transaction.Entries.Single().AccountId);

        var duplicate = Assert.Throws<FinancialRuleException>(() =>
            plan.Realize(new DateOnly(2026, 2, 28), Guid.NewGuid(), actor, realizedAt, [first.Occurrence]));
        Assert.Equal(FinancialErrorCodes.RecurringOccurrenceAlreadyRealized, duplicate.Code);

        var march = plan.Realize(new DateOnly(2026, 3, 31), Guid.NewGuid(), actor, realizedAt, [first.Occurrence]);
        Assert.NotEqual(first.Transaction.Id, march.Transaction.Id);
        Assert.Equal(new DateOnly(2026, 3, 31), march.Occurrence.ScheduledOn);
    }

    [Fact]
    public void RealizationRejectsDatesThePlanDoesNotProduce()
    {
        var plan = NewPlan(31, new DateOnly(2026, 1, 1));
        var startedLater = NewPlan(5, new DateOnly(2026, 1, 10));
        var ended = RecurringPlan.Create(plan.Id, plan.HouseholdId, plan.Name, plan.Flow,
            plan.AccountId, plan.CategoryId, null, plan.Amount.Cents, plan.Amount.Currency,
            plan.DayOfMonth, plan.StartsOn, new DateOnly(2026, 3, 30));
        var actor = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        Assert.Throws<FinancialRuleException>(() =>
            plan.Realize(new DateOnly(2026, 2, 27), Guid.NewGuid(), actor, now, []));
        Assert.Throws<FinancialRuleException>(() =>
            startedLater.Realize(new DateOnly(2026, 1, 5), Guid.NewGuid(), actor, now, []));
        var afterEnd = Assert.Throws<FinancialRuleException>(() =>
            ended.Realize(new DateOnly(2026, 3, 31), Guid.NewGuid(), actor, now, []));
        Assert.Equal(FinancialErrorCodes.InvalidRecurringPlan, afterEnd.Code);
    }

    [Fact]
    public void PausedOrArchivedPlanCannotBeRealized()
    {
        var plan = NewPlan(5, new DateOnly(2026, 1, 1));
        var actor = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        Assert.Throws<FinancialRuleException>(() => plan.ChangeStatus(RecurringPlanStatus.Paused)
            .Realize(new DateOnly(2026, 2, 5), Guid.NewGuid(), actor, now, []));
        Assert.Throws<FinancialRuleException>(() => plan.ChangeStatus(RecurringPlanStatus.Archived)
            .Realize(new DateOnly(2026, 2, 5), Guid.NewGuid(), actor, now, []));
    }

    [Fact]
    public void IncomeRealizationKeepsTheSourceAndRejectsAnotherPlansHistory()
    {
        var sourceId = Guid.NewGuid();
        var actor = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var plan = RecurringPlan.Create(Guid.NewGuid(), Guid.NewGuid(), "Salary",
            FinancialFlow.Income, Guid.NewGuid(), Guid.NewGuid(), sourceId,
            500000, "BRL", 5, new DateOnly(2026, 1, 1), null);
        var realized = plan.Realize(new DateOnly(2026, 2, 5), Guid.NewGuid(), actor, now, []);
        Assert.Equal(FinancialTransactionKind.Income, realized.Transaction.Kind);
        Assert.Equal(sourceId, realized.Transaction.IncomeSourceId);
        Assert.Equal(EntryDirection.Credit, realized.Transaction.Entries.Single().Direction);

        var other = NewPlan(5, new DateOnly(2026, 1, 1));
        var foreign = Assert.Throws<FinancialRuleException>(() =>
            other.Realize(new DateOnly(2026, 2, 5), Guid.NewGuid(), actor, now, [realized.Occurrence]));
        Assert.Equal(FinancialErrorCodes.InvalidRecurringPlan, foreign.Code);
    }

    private static RecurringPlan NewPlan(int day, DateOnly startsOn) =>
        RecurringPlan.Create(Guid.NewGuid(), Guid.NewGuid(), "Rent", FinancialFlow.Expense,
            Guid.NewGuid(), Guid.NewGuid(), null, 180000, "BRL", day, startsOn, null);
}
