using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class FinancialPeriodTests
{
    [Fact]
    public void CreatesMonthlyPeriodCorrectly()
    {
        var period = FinancialPeriod.Monthly(2026, 10);
        Assert.Equal(new DateOnly(2026, 10, 1), period.Start);
        Assert.Equal(new DateOnly(2026, 10, 31), period.End);
    }

    [Fact]
    public void CreatesWeeklyPeriodCorrectly()
    {
        var startOfWeek = new DateOnly(2026, 10, 5);
        var period = FinancialPeriod.Weekly(startOfWeek);
        Assert.Equal(startOfWeek, period.Start);
        Assert.Equal(new DateOnly(2026, 10, 11), period.End);
    }

    [Fact]
    public void CreatesCustomPeriodCorrectly()
    {
        var start = new DateOnly(2026, 10, 1);
        var end = new DateOnly(2026, 10, 15);
        var period = FinancialPeriod.Custom(start, end);
        Assert.Equal(start, period.Start);
        Assert.Equal(end, period.End);
    }

    [Fact]
    public void RejectsCustomPeriodWhereStartIsAfterEnd()
    {
        var start = new DateOnly(2026, 10, 15);
        var end = new DateOnly(2026, 10, 1);
        var ex = Assert.Throws<FinancialRuleException>(() => FinancialPeriod.Custom(start, end));
        Assert.Equal(FinancialErrorCodes.InvalidPeriod, ex.Code);
    }
}
