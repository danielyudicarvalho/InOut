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
