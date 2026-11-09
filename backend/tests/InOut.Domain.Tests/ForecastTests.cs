using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class ForecastTests
{
    [Fact]
    public void ProjectsMonthlyAccountBalanceFromActivePlansWithoutPosting()
    {
        var income = Plan(FinancialFlow.Income, 31, 20000);
        var expense = Plan(FinancialFlow.Expense, 5, 5000);
        var paused = Plan(FinancialFlow.Expense, 5, 100000)
            .ChangeStatus(RecurringPlanStatus.Paused);

        var projection = Forecast.Project(new DateOnly(2026, 1, 10), 2, 100000,
            [income, expense, paused]);
        var points = projection.Points;

        Assert.Equal(120000, points[0].ProjectedBalanceCents);
        Assert.Equal(135000, points[1].ProjectedBalanceCents);
        Assert.Equal(20000, points[0].ExpectedIncomeCents);
        Assert.Equal(0, points[0].ExpectedExpenseCents);
        Assert.Equal(5000, points[1].ExpectedExpenseCents);
        Assert.Contains(income.Id, points[1].RecurringPlanIds);
        Assert.DoesNotContain(paused.Id, points[1].RecurringPlanIds);
        Assert.Equal(income.Amount.Cents, points[1].Contributions.Single(item => item.PlanId == income.Id).AmountCents);
        Assert.Contains(projection.Assumptions, item => item.PlanId == income.Id && item.AmountCents == 20000 && item.DayOfMonth == 31);
        Assert.DoesNotContain(projection.Assumptions, item => item.PlanId == paused.Id);
    }

    [Fact]
    public void SavedAssumptionsKeepThePlanTermsUsedAtProjection()
    {
        var rent = Plan(FinancialFlow.Expense, 31, 180000);
        var projection = Forecast.Project(new DateOnly(2026, 2, 1), 1, 0, [rent]);
        var edited = RecurringPlan.Create(rent.Id, rent.HouseholdId, "Changed", rent.Flow,
            rent.AccountId, rent.CategoryId, null, 1, "USD", 1, rent.StartsOn, null);

        var point = projection.Points.Single();
        var assumption = projection.Assumptions.Single();
        var contribution = point.Contributions.Single();
        Assert.Equal(new DateOnly(2026, 2, 28), contribution.ScheduledOn);
        Assert.Equal(180000, contribution.AmountCents);
        Assert.Equal(180000, point.ExpectedExpenseCents);
        Assert.Equal("Monthly", assumption.Name);
        Assert.Equal(180000, assumption.AmountCents);
        Assert.Equal("BRL", assumption.Currency);
        Assert.Equal(31, assumption.DayOfMonth);
        Assert.Equal(RecurringPlanStatus.Active, assumption.Status);
        Assert.NotEqual(edited.Amount.Cents, assumption.AmountCents);
        Assert.NotEqual(edited.Name, assumption.Name);
    }

    [Fact]
    public void OpeningBalanceStopsAtTheReferenceDate()
    {
        var asOf = new DateOnly(2026, 2, 15);
        var balance = Forecast.OpeningBalance(asOf, [
            new ForecastMovement(new DateOnly(2026, 1, 10), EntryDirection.Credit, 5_000),
            new ForecastMovement(new DateOnly(2026, 1, 20), EntryDirection.Debit, 1_000),
            new ForecastMovement(asOf, EntryDirection.Credit, 100),
            new ForecastMovement(new DateOnly(2026, 3, 1), EntryDirection.Debit, 500),
            new ForecastMovement(new DateOnly(2026, 3, 2), EntryDirection.Credit, 1_000),
        ]);

        Assert.Equal(4_100, balance);
        Assert.Equal(0, Forecast.OpeningBalance(asOf, []));
    }

    [Fact]
    public void EmptyPlansCarryOpeningBalanceAndRejectLongHorizons()
    {
        var empty = Forecast.Project(new DateOnly(2026, 2, 1), 1, 42, []);
        Assert.Equal(42, empty.Points.Single().ProjectedBalanceCents);
        Assert.Empty(empty.Assumptions);
        Assert.Empty(empty.Points.Single().Contributions);
        Assert.Throws<FinancialRuleException>(() =>
            Forecast.Project(new DateOnly(2026, 2, 1), 13, 42, []));
    }

    private static RecurringPlan Plan(FinancialFlow flow, int day, long amount) =>
        RecurringPlan.Create(Guid.NewGuid(), Guid.NewGuid(), "Monthly", flow,
            Guid.NewGuid(), Guid.NewGuid(), null, amount, "BRL", day,
            new DateOnly(2026, 1, 1), null);
}
