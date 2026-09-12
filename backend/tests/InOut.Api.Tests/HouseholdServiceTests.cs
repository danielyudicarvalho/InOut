using InOut.Application.Households;
using InOut.Domain.Households;
using Xunit;

namespace InOut.Api.Tests;

public sealed class HouseholdServiceTests
{
    [Fact]
    public async Task CreateNormalizesTheNameBeforePersistence()
    {
        var store = new RecordingStore();
        var service = new HouseholdService(store, TimeProvider.System);

        await service.CreateAsync(Guid.NewGuid(), "  Minha casa  ", default);

        Assert.Equal("Minha casa", store.CreatedName);
    }

    [Fact]
    public async Task InvitationIsOpaqueAndExpiresAfterTwentyFourHours()
    {
        var now = new DateTimeOffset(2026, 9, 11, 12, 0, 0, TimeSpan.Zero);
        var store = new RecordingStore();
        var service = new HouseholdService(store, new FixedTimeProvider(now));

        var invitation = await service.CreateInvitationAsync(
            Guid.NewGuid(), Guid.NewGuid(), default);

        Assert.Equal(48, invitation.Code.Length);
        Assert.All(invitation.Code, character => Assert.True(char.IsAsciiHexDigit(character)));
        Assert.Equal(now.AddHours(24), invitation.ExpiresAt);
        Assert.Equal(32, store.TokenHash?.Length);
        Assert.NotEqual(invitation.Code, Convert.ToHexString(store.TokenHash!).ToLowerInvariant());
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-code")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaZ")]
    public async Task RejectsMalformedInvitationWithoutCallingPersistence(string code)
    {
        var store = new RecordingStore();
        var service = new HouseholdService(store, TimeProvider.System);

        await Assert.ThrowsAsync<HouseholdRuleException>(() =>
            service.AcceptInvitationAsync(Guid.NewGuid(), code, default));
        Assert.Null(store.TokenHash);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class RecordingStore : IHouseholdStore
    {
        public string? CreatedName { get; private set; }
        public byte[]? TokenHash { get; private set; }

        public Task<IReadOnlyList<Household>> ListAsync(Guid userId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Household>>([]);

        public Task<Household> CreateAsync(
            Guid userId,
            string name,
            CancellationToken cancellationToken)
        {
            CreatedName = name;
            return Task.FromResult(new Household(Guid.NewGuid(), name));
        }

        public Task SaveInvitationAsync(
            Guid userId,
            Guid householdId,
            byte[] tokenHash,
            DateTimeOffset expiresAt,
            CancellationToken cancellationToken)
        {
            TokenHash = tokenHash;
            return Task.CompletedTask;
        }

        public Task<Household> AcceptInvitationAsync(
            Guid userId,
            byte[] tokenHash,
            CancellationToken cancellationToken)
        {
            TokenHash = tokenHash;
            return Task.FromResult(new Household(Guid.NewGuid(), "Casa"));
        }
    }
}
