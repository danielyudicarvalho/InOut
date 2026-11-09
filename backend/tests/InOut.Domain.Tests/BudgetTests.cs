using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class BudgetTests
{
    [Theory]
    [InlineData("usd", "USD")]
    [InlineData(" brl ", "BRL")]
    public void BudgetKeepsExplicitCurrencyWhenLimitChanges(string input, string expected)
    {
        var budget = Budget.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31), 1000, input);
        Assert.Equal(expected, budget.Currency);
        Assert.Equal(expected, budget.UpdateLimit(2000).Currency);
    }

    [Theory]
    [InlineData("")]
    [InlineData("US")]
    [InlineData("123")]
    public void BudgetRejectsMissingOrMalformedCurrency(string currency)
    {
        var ex = Assert.Throws<FinancialRuleException>(() => Budget.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31), 1000, currency));
        Assert.Equal(FinancialErrorCodes.InvalidCurrency, ex.Code);
    }

    [Fact]
    public void CreateValidParametersReturnsBudget()
    {
        var id = Guid.NewGuid();
        var householdId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var periodStart = new DateOnly(2026, 10, 1);
        var periodEnd = new DateOnly(2026, 10, 31);
        long limitCents = 150000; // R$ 1.500,00

        var budget = Budget.Create(id, householdId, categoryId, periodStart, periodEnd, limitCents, "BRL");

        Assert.Equal(id, budget.Id);
        Assert.Equal(householdId, budget.HouseholdId);
        Assert.Equal(categoryId, budget.CategoryId);
        Assert.Equal(periodStart, budget.PeriodStart);
        Assert.Equal(periodEnd, budget.PeriodEnd);
        Assert.Equal(limitCents, budget.LimitCents);
    }

    [Fact]
    public void CreateNonPositiveLimitThrowsFinancialRuleException()
    {
        var ex = Assert.Throws<FinancialRuleException>(() => Budget.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            new DateOnly(2026, 10, 1),
            new DateOnly(2026, 10, 31),
            0, "BRL"));

        Assert.Equal(FinancialErrorCodes.InvalidAmount, ex.Code);
    }

    [Fact]
    public void CreateInvalidPeriodThrowsFinancialRuleException()
    {
        var ex = Assert.Throws<FinancialRuleException>(() => Budget.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            new DateOnly(2026, 10, 31),
            new DateOnly(2026, 10, 1),
            5000, "BRL"));

        Assert.Equal(FinancialErrorCodes.InvalidPeriod, ex.Code);
    }

    [Fact]
    public void UpdateLimitValidLimitReturnsUpdatedBudget()
    {
        var budget = Budget.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            new DateOnly(2026, 10, 1),
            new DateOnly(2026, 10, 31),
            10000, "BRL");

        var updated = budget.UpdateLimit(20000);

        Assert.Equal(20000, updated.LimitCents);
        Assert.Equal(budget.Id, updated.Id);
    }

    [Fact]
    public void UpdateLimitNonPositiveLimitThrowsFinancialRuleException()
    {
        var budget = Budget.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            new DateOnly(2026, 10, 1),
            new DateOnly(2026, 10, 31),
            10000, "BRL");

        var ex = Assert.Throws<FinancialRuleException>(() => budget.UpdateLimit(-100));

        Assert.Equal(FinancialErrorCodes.InvalidAmount, ex.Code);
    }
}
