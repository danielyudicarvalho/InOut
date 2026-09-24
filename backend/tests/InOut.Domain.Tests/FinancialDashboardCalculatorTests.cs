using InOut.Domain.Financial;
using Xunit;

namespace InOut.Domain.Tests;

public sealed class FinancialDashboardCalculatorTests
{
    private readonly Guid accountId = Guid.NewGuid();
    private readonly Guid categoryId = Guid.NewGuid();

    [Fact]
    public void ExcludesTransfersAndOpeningBalancesFromThePeriodResult()
    {
        var totals = Calculate(
            new DashboardPosting(
                accountId, null, FinancialTransactionKind.Transfer, null, 200),
            new DashboardPosting(
                accountId, null, FinancialTransactionKind.OpeningBalance, null, 500));

        var currency = Assert.Single(totals.Currencies);
        Assert.Equal(0, currency.IncomeCents);
        Assert.Equal(0, currency.ExpenseCents);
        Assert.Equal(0, currency.ResultCents);
    }

    [Fact]
    public void ReversalSubtractsTheOriginalOperationKind()
    {
        var totals = Calculate(
            new DashboardPosting(
                accountId, categoryId, FinancialTransactionKind.Expense, null, 250),
            new DashboardPosting(
                accountId, categoryId, FinancialTransactionKind.Reversal,
                FinancialTransactionKind.Expense, 250));

        var currency = Assert.Single(totals.Currencies);
        Assert.Equal(0, currency.ExpenseCents);
        Assert.Empty(totals.Categories);
    }

    [Fact]
    public void NeverConsolidatesDifferentCurrencies()
    {
        var otherAccountId = Guid.NewGuid();
        var totals = FinancialDashboardCalculator.Calculate(
            [
                new DashboardAccountSnapshot(accountId, "BRL", 1_000),
                new DashboardAccountSnapshot(otherAccountId, "USD", 300),
            ],
            [
                new DashboardPosting(
                    accountId, categoryId, FinancialTransactionKind.Income, null, 1_000),
                new DashboardPosting(
                    otherAccountId, categoryId, FinancialTransactionKind.Income, null, 300),
            ]);

        Assert.Collection(
            totals.Currencies,
            brl =>
            {
                Assert.Equal("BRL", brl.Currency);
                Assert.Equal(1_000, brl.IncomeCents);
            },
            usd =>
            {
                Assert.Equal("USD", usd.Currency);
                Assert.Equal(300, usd.IncomeCents);
            });
    }

    [Fact]
    public void RejectsInvalidMonthlyPeriod()
    {
        var exception = Assert.Throws<FinancialRuleException>(() =>
            FinancialPeriod.Monthly(2026, 13));

        Assert.Equal(FinancialErrorCodes.InvalidPeriod, exception.Code);
    }

    private FinancialDashboardTotals Calculate(params DashboardPosting[] postings) =>
        FinancialDashboardCalculator.Calculate(
            [new DashboardAccountSnapshot(accountId, "BRL", 0)],
            postings);
}
