using InOut.Application.Financial.Dashboard;
using InOut.Application.Security;
using InOut.Domain.Financial;
using InOut.Domain.Households;
using Xunit;
namespace InOut.Api.Tests;

public sealed class GetFinancialAnalysisTests
{
    [Fact]
    public async Task RejectsNonMemberBeforeReading()
    {
        var reader = new Reader();
        await Assert.ThrowsAsync<HouseholdRuleException>(() => new GetFinancialAnalysis(new Member(false), reader).ExecuteAsync(
            Guid.NewGuid(), Guid.NewGuid(), "BRL", new(2026, 10, 1), new(2026, 10, 31), CancellationToken.None));
        Assert.Equal(0, reader.Calls);
    }
    [Fact]
    public async Task IncludesTransfersInAccountChangeButExcludesThemFromResultAndKeepsHistory()
    {
        var reader = new Reader();
        var report = await new GetFinancialAnalysis(new Member(true), reader).ExecuteAsync(
            Guid.NewGuid(), Guid.NewGuid(), "BRL", new(2026, 10, 1), new(2026, 10, 31), CancellationToken.None);
        Assert.Equal(1, reader.Calls);
        Assert.Equal(800, report.Current.ResultCents);
        Assert.Equal(500, report.Previous.IncomeCents);
        Assert.Equal(6, report.Series.Count);
        Assert.Equal(new DateOnly(2026, 5, 1), reader.From);
        Assert.Equal(800, report.Series[^1].ResultCents);
        var a = report.Accounts[0];
        Assert.Equal(300, a.TransferOutCents);
        Assert.Equal(500, a.ChangeCents);
        Assert.Equal(300, report.Accounts[^1].TransferInCents);
        Assert.Equal(800, report.Accounts.Sum(a => a.ChangeCents));
        Assert.Equal(500, report.Changes.Single(c => c.Kind == "income").DeltaCents);
        Assert.Equal(100, report.Changes.Single(c => c.Kind == "income").PercentageChange);
        Assert.Null(report.Changes.Single(c => c.Kind == "expense").PercentageChange);
    }
    [Fact]
    public async Task CustomIntervalUsesEqualLengthPriorAndClipsMonthlyBuckets()
    {
        var report = await new GetFinancialAnalysis(new Member(true), new Reader()).ExecuteAsync(
            Guid.NewGuid(), Guid.NewGuid(), "BRL", new(2026, 9, 20), new(2026, 10, 10), CancellationToken.None);
        Assert.Equal(new DateOnly(2026, 8, 30), report.PreviousFrom);
        Assert.Equal(new DateOnly(2026, 9, 19), report.PreviousTo);
        Assert.Equal(2, report.Series.Count);
        Assert.Equal(new DateOnly(2026, 9, 20), report.Series[0].From);
        Assert.Equal(new DateOnly(2026, 10, 10), report.Series[^1].To);
    }
    private sealed class Member(bool allowed) : IHouseholdMembershipReader
    {
        public Task<bool> IsMemberAsync(Guid userId, Guid householdId, CancellationToken ct) => Task.FromResult(allowed);
    }
    private sealed class Reader : IDashboardReader
    {
        public int Calls { get; private set; }
        public DateOnly From { get; private set; }
        public Task<DashboardSourceData> ReadAsync(Guid actor, Guid home, FinancialPeriod period, CancellationToken ct) => throw new InvalidOperationException("Must retain archived accounts.");
        public Task<DashboardSourceData> ReadIncomeHistoryAsync(Guid actor, Guid home, FinancialPeriod period, CancellationToken ct)
        {
            Calls++; From = period.Start;
            var a = Guid.NewGuid(); var b = Guid.NewGuid(); var usd = Guid.NewGuid();
            DashboardPosting P(Guid account, FinancialTransactionKind kind, long amount, int month, EntryDirection direction) => new(account, null, kind, null, amount, OccurredOn: new(2026, month, 5), Direction: direction);
            return Task.FromResult(new DashboardSourceData(
                [new(a, "Principal", "BRL", 500), new(b, "Arquivada", "BRL", 300), new(usd, "USD", "USD", 999)], [],
                [P(a, FinancialTransactionKind.Income, 500, 9, EntryDirection.Credit), P(a, FinancialTransactionKind.Income, 1000, 10, EntryDirection.Credit),
                 P(a, FinancialTransactionKind.Expense, 200, 10, EntryDirection.Debit), P(a, FinancialTransactionKind.Transfer, 300, 10, EntryDirection.Debit),
                 P(b, FinancialTransactionKind.Transfer, 300, 10, EntryDirection.Credit), P(usd, FinancialTransactionKind.Income, 999, 10, EntryDirection.Credit)], [], [], [], 6, 6));
        }
    }
}
