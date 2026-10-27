using InOut.Application.Financial.Dashboard;
using InOut.Application.Security;
using InOut.Domain.Financial;
using InOut.Domain.Households;
using Xunit;

namespace InOut.Api.Tests;

public sealed class GetIncomeBreakdownTests
{
    [Fact]
    public async Task RejectsNonMemberBeforeReadingLedger()
    {
        var reader = new Reader(new DashboardSourceData([], [], [], [], [], [], 0, 0));
        var service = new GetIncomeBreakdown(new Member(false), reader);
        await Assert.ThrowsAsync<HouseholdRuleException>(() => service.ExecuteAsync(
            new GetIncomeBreakdownQuery(Guid.NewGuid(), Guid.NewGuid(), "BRL", 2026, 10), CancellationToken.None));
        Assert.False(reader.Called);
    }

    [Fact]
    public async Task MatchesDashboardIncomeIncludingReversalsAndExcludesTransfersAndOtherCurrencies()
    {
        var account = Guid.NewGuid();
        var other = Guid.NewGuid();
        var income = new DashboardPosting(account, null, FinancialTransactionKind.Income, null, 600000,
            TransactionId: Guid.NewGuid(), EntryId: Guid.NewGuid(), OccurredOn: new DateOnly(2026, 10, 5));
        var reversal = new DashboardPosting(account, null, FinancialTransactionKind.Reversal, FinancialTransactionKind.Income, 100000,
            TransactionId: Guid.NewGuid(), EntryId: Guid.NewGuid(), OccurredOn: new DateOnly(2026, 10, 10));
        var source = new DashboardSourceData(
            [new DashboardAccountSource(account, "Principal", "BRL", 500000), new DashboardAccountSource(other, "USD", "USD", 500)],
            [], [income, reversal, new DashboardPosting(account, null, FinancialTransactionKind.Transfer, null, 900),
                new DashboardPosting(account, null, FinancialTransactionKind.Reversal, FinancialTransactionKind.Transfer, 400),
                new DashboardPosting(other, null, FinancialTransactionKind.Income, null, 500)], [], [], [], 2, 2);
        var service = new GetIncomeBreakdown(new Member(true), new Reader(source));
        var result = await service.ExecuteAsync(new GetIncomeBreakdownQuery(Guid.NewGuid(), Guid.NewGuid(), "BRL", 2026, 10, Offset: 0, Limit: 1), CancellationToken.None);
        var totals = FinancialDashboardCalculator.Calculate(source.Accounts.Select(a => new DashboardAccountSnapshot(a.Id, a.Currency, a.BalanceCents)).ToArray(), source.Postings);
        Assert.Equal(500000L, result.TotalCents);
        Assert.Equal(totals.Currencies.Single(row => row.Currency == "BRL").IncomeCents, result.TotalCents);
        Assert.Equal(2, result.TotalCount);
        Assert.Single(result.Items);
        Assert.True(result.Items[0].IsReversal);
        Assert.Equal(-100000L, result.Items[0].AmountCents);
    }

    private sealed class Member(bool allowed) : IHouseholdMembershipReader
    {
        public Task<bool> IsMemberAsync(Guid userId, Guid householdId, CancellationToken cancellationToken) => Task.FromResult(allowed);
    }
    private sealed class Reader(DashboardSourceData data) : IDashboardReader
    {
        public bool Called { get; private set; }
        public Task<DashboardSourceData> ReadAsync(Guid actorUserId, Guid householdId, FinancialPeriod period, CancellationToken cancellationToken)
        { Called = true; return Task.FromResult(data); }
    }
}
