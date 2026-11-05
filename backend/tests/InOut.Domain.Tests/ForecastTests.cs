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

        var points = Forecast.Project(new DateOnly(2026, 1, 10), 2, 100000,
            [income, expense, paused]);

        Assert.Equal(120000, points[0].ProjectedBalanceCents);
        Assert.Equal(135000, points[1].ProjectedBalanceCents);
        Assert.Equal(20000, points[0].ExpectedIncomeCents);
        Assert.Equal(0, points[0].ExpectedExpenseCents);
        Assert.Equal(5000, points[1].ExpectedExpenseCents);
        Assert.Contains(income.Id, points[1].RecurringPlanIds);
        Assert.DoesNotContain(paused.Id, points[1].RecurringPlanIds);
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
        Assert.Equal(42, Forecast.Project(new DateOnly(2026, 2, 1), 1, 42, [])
            .Single().ProjectedBalanceCents);
        Assert.Throws<FinancialRuleException>(() =>
            Forecast.Project(new DateOnly(2026, 2, 1), 13, 42, []));
    }

    private static RecurringPlan Plan(FinancialFlow flow, int day, long amount) =>
        RecurringPlan.Create(Guid.NewGuid(), Guid.NewGuid(), "Monthly", flow,
            Guid.NewGuid(), Guid.NewGuid(), null, amount, "BRL", day,
            new DateOnly(2026, 1, 1), null);
}
