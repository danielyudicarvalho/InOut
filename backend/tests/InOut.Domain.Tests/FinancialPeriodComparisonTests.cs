using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class FinancialPeriodComparisonTests
{
    [Fact]
    public void CalculatesPreviousMonthlyPeriodCorrectly()
    {
        var oct = FinancialPeriod.Monthly(2026, 10);
        var sep = oct.GetPreviousPeriod();

        Assert.Equal(new DateOnly(2026, 9, 1), sep.Start);
        Assert.Equal(new DateOnly(2026, 9, 30), sep.End);
    }

    [Fact]
    public void CalculatesPreviousYearMonthlyPeriodCorrectly()
    {
        var jan = FinancialPeriod.Monthly(2026, 1);
        var dec = jan.GetPreviousPeriod();

        Assert.Equal(new DateOnly(2025, 12, 1), dec.Start);
        Assert.Equal(new DateOnly(2025, 12, 31), dec.End);
    }

    [Fact]
    public void CalculatesPreviousWeeklyPeriodCorrectly()
    {
        var week = FinancialPeriod.Weekly(new DateOnly(2026, 10, 8));
        var prevWeek = week.GetPreviousPeriod();

        Assert.Equal(new DateOnly(2026, 10, 1), prevWeek.Start);
        Assert.Equal(new DateOnly(2026, 10, 7), prevWeek.End);
    }

    [Fact]
    public void DistinguishesAuthoritativeFactsFromInterpretations()
    {
        var currentPeriod = FinancialPeriod.Monthly(2026, 10);
        var previousPeriod = currentPeriod.GetPreviousPeriod();
        var accountId = Guid.NewGuid();

        var currentTotals = FinancialDashboardCalculator.Calculate(
            [new DashboardAccountSnapshot(accountId, "BRL", 1000)],
            [new DashboardPosting(accountId, null, FinancialTransactionKind.Income, null, 500)]);

        var previousTotals = FinancialDashboardCalculator.Calculate(
            [new DashboardAccountSnapshot(accountId, "BRL", 500)],
            [new DashboardPosting(accountId, null, FinancialTransactionKind.Income, null, 400)]);

        var comparison = FinancialPeriodComparator.Compare(
            currentPeriod,
            previousPeriod,
            currentTotals,
            previousTotals);

        var currency = Assert.Single(comparison.Currencies);
        Assert.Equal("BRL", currency.Currency);

        // Authoritative Facts
        Assert.Equal(500, currency.CurrentFacts.IncomeCents);
        Assert.Equal(400, currency.PreviousFacts.IncomeCents);

        // Interpretation / Deltas
        Assert.Equal(100, currency.Deltas.IncomeDeltaCents);
        Assert.Equal(25.0, currency.Deltas.IncomePercentageChange);
    }
}
