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

        Assert.Equal(actorUserId, reader.ActorUserId);
        Assert.Equal(householdId, reader.HouseholdId);
        Assert.Equal(new DateOnly(2026, 9, 1), dashboard.PeriodStart);
        Assert.Equal(new DateOnly(2026, 9, 30), dashboard.PeriodEnd);
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
            return Task.FromResult(new DashboardSourceData([], [], [], [], [], 0, 0));
        }
    }
}
