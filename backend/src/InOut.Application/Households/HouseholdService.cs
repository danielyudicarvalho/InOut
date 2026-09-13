using System.Security.Cryptography;
using InOut.Domain.Households;

namespace InOut.Application.Households;

public sealed class HouseholdService(IHouseholdStore store, TimeProvider timeProvider)
{
    public Task<IReadOnlyList<Household>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken) => store.ListAsync(userId, cancellationToken);

    public Task<Household> CreateAsync(
        Guid userId,
        string? name,
        CancellationToken cancellationToken) =>
        store.CreateAsync(userId, HouseholdRules.NormalizeName(name), cancellationToken);

    public async Task<HouseholdInvitation> CreateInvitationAsync(
        Guid userId,
        Guid householdId,
        CancellationToken cancellationToken)
    {
        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var expiresAt = timeProvider.GetUtcNow().Add(HouseholdRules.InvitationLifetime);
        await store.SaveInvitationAsync(
            userId,
            householdId,
            SHA256.HashData(Convert.FromHexString(code)),
            expiresAt,
            cancellationToken);
        return new HouseholdInvitation(code, expiresAt);
    }

    public Task<Household> AcceptInvitationAsync(
        Guid userId,
        string? code,
        CancellationToken cancellationToken)
    {
        var normalized = HouseholdRules.NormalizeInviteCode(code);
        return store.AcceptInvitationAsync(
            userId,
            SHA256.HashData(Convert.FromHexString(normalized)),
            cancellationToken);
    }
}
