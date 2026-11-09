using InOut.Application.Financial.Dashboard;
using InOut.Application.Security;
using InOut.Domain.Financial;
using InOut.Domain.Households;
using Xunit;

namespace InOut.Api.Tests;

public sealed class GetFinancialDashboardTests
{
    [Fact]
    public async Task RejectsNonMemberWithoutReadingFinancialData()
    {
        var reader = new RecordingDashboardReader();
        var useCase = new GetFinancialDashboard(new MembershipReader(false), reader);

        var exception = await Assert.ThrowsAsync<HouseholdRuleException>(() =>
            useCase.ExecuteAsync(
                new GetFinancialDashboardQuery(Guid.NewGuid(), Guid.NewGuid(), 2026, 9),
                CancellationToken.None));

        Assert.Equal(HouseholdErrorCodes.MembershipRequired, exception.Code);
        Assert.False(reader.WasCalled);
    }

    [Fact]
    public async Task PassesActorAndValidatedPeriodToReader()
    {
        var actorUserId = Guid.NewGuid();
        var householdId = Guid.NewGuid();
        var reader = new RecordingDashboardReader();
        var useCase = new GetFinancialDashboard(new MembershipReader(true), reader);

        var dashboard = await useCase.ExecuteAsync(
            new GetFinancialDashboardQuery(actorUserId, householdId, 2026, 9),
            CancellationToken.None);

        Assert.True(dashboard.HasFinancialActivity is true);
        Assert.Equal(actorUserId, reader.ActorUserId);
        Assert.Equal(householdId, reader.HouseholdId);
        Assert.Equal(new DateOnly(2026, 9, 1), dashboard.PeriodStart);
        Assert.Equal(new DateOnly(2026, 9, 30), dashboard.PeriodEnd);
    }

    [Fact]
    public async Task PassesCustomDateRangePeriodToReader()
    {
        var actorUserId = Guid.NewGuid();
        var householdId = Guid.NewGuid();
        var reader = new RecordingDashboardReader();
        var useCase = new GetFinancialDashboard(new MembershipReader(true), reader);

        var from = new DateOnly(2026, 10, 5);
        var to = new DateOnly(2026, 10, 11);
        var dashboard = await useCase.ExecuteAsync(
            new GetFinancialDashboardQuery(actorUserId, householdId, From: from, To: to),
            CancellationToken.None);

        Assert.Equal(from, dashboard.PeriodStart);
        Assert.Equal(to, dashboard.PeriodEnd);
    }

    [Fact]
    public async Task PreservesInitialBalanceAndExplicitNoActivityWhenPeriodHasNoPostings()
    {
        var account = Guid.NewGuid();
        var reader = new RecordingDashboardReader
        {
            Data = new DashboardSourceData(
                [new DashboardAccountSource(account, "Carteira", "BRL", 0, -500)],
                [], [], [], [], [], 0, 0, false)
        };
        var dashboard = await new GetFinancialDashboard(new MembershipReader(true), reader).ExecuteAsync(
            new GetFinancialDashboardQuery(Guid.NewGuid(), Guid.NewGuid(), 2026, 9), CancellationToken.None);
        Assert.True(dashboard.HasFinancialActivity is false);
        Assert.Equal<long?>(-500L, dashboard.Accounts.Single().InitialBalanceCents);
        Assert.Equal(0L, dashboard.Accounts.Single().BalanceCents);
    }

    [Fact]
    public async Task BudgetsOnlyConsumeTheirOwnCurrencyIncludingReversalsAndUnresolvedLegacyAmounts()
    {
        var category = Guid.NewGuid(); var brl = Guid.NewGuid(); var usd = Guid.NewGuid();
        var reader = new RecordingDashboardReader
        {
            Data = new DashboardSourceData(
            [new(brl, "BRL account", "BRL", 0), new(usd, "USD account", "USD", 0)],
            [new(category, "Food", null)],
            [new(brl, category, FinancialTransactionKind.Expense, null, 10000),
             new(usd, category, FinancialTransactionKind.Expense, null, 500),
             new(usd, category, FinancialTransactionKind.Reversal, FinancialTransactionKind.Expense, 100)],
            [new(Guid.NewGuid(), category, 20000, "BRL"), new(Guid.NewGuid(), category, 1000, "USD"),
             new(Guid.NewGuid(), category, 1000, "EUR"), new(Guid.NewGuid(), category, 1000, null)],
            [new(Guid.NewGuid(), "Travel", 1000, 500, null, "USD"), new(Guid.NewGuid(), "Legacy", 1000, 500, null, null)],
            [], 3, 3)
        };
        var dashboard = await new GetFinancialDashboard(new MembershipReader(true), reader).ExecuteAsync(
            new GetFinancialDashboardQuery(Guid.NewGuid(), Guid.NewGuid(), 2026, 10), CancellationToken.None);
        Assert.Equal(10000L, dashboard.Budgets.Single(b => b.Currency == "BRL").SpentCents);
        Assert.Equal(400L, dashboard.Budgets.Single(b => b.Currency == "USD").SpentCents);
        Assert.Equal(0L, dashboard.Budgets.Single(b => b.Currency == "EUR").SpentCents);
        var legacy = dashboard.Budgets.Single(b => b.Currency is null);
        Assert.Null(legacy.SpentCents);
        Assert.True(legacy.RequiresCurrencySelection);
        Assert.False(dashboard.Budgets.Single(b => b.Currency == "USD").RequiresCurrencySelection);
        Assert.True(dashboard.Goals.Single(g => g.Name == "Legacy").RequiresCurrencySelection);
        Assert.Equal("USD", dashboard.Goals.Single(g => g.Name == "Travel").Currency);
    }

    private sealed class MembershipReader(bool isMember) : IHouseholdMembershipReader
    {
        public Task<bool> IsMemberAsync(
            Guid userId,
            Guid householdId,
            CancellationToken cancellationToken) =>
            Task.FromResult(isMember);
    }

    private sealed class RecordingDashboardReader : IDashboardReader
    {
        public DashboardSourceData Data { get; init; } = new([], [], [], [], [], [], 0, 0, true);

        public bool WasCalled { get; private set; }

        public Guid ActorUserId { get; private set; }

        public Guid HouseholdId { get; private set; }

        public Task<DashboardSourceData> ReadAsync(
            Guid actorUserId,
            Guid householdId,
            FinancialPeriod period,
            CancellationToken cancellationToken)
        {
            WasCalled = true;
            ActorUserId = actorUserId;
            HouseholdId = householdId;
            return Task.FromResult(Data);
        }
    }
}
