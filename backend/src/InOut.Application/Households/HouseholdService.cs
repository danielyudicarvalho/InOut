using System.Security.Cryptography;
using InOut.Application.Utils;
using InOut.Domain.Households;

namespace InOut.Application.Households;

public sealed class HouseholdService(IHouseholdStore store, TimeProvider timeProvider)
{
    public Task<HouseholdContext> GetContextAsync(Guid actorId, Guid householdId, CancellationToken ct) => store.GetContextAsync(actorId, householdId, ct);
    public Task<IReadOnlyList<InvitationSummary>> ListInvitationsAsync(Guid actorId, Guid householdId, CancellationToken ct) => store.ListInvitationsAsync(actorId, householdId, ct);
    public Task ChangeRoleAsync(Guid actorId, Guid householdId, Guid memberId, HouseholdRole role, CancellationToken ct) => store.ChangeRoleAsync(actorId, householdId, memberId, role, ct);
    public Task RemoveMemberAsync(Guid actorId, Guid householdId, Guid memberId, CancellationToken ct) => store.RemoveMemberAsync(actorId, householdId, memberId, ct);
    public Task RevokeInvitationAsync(Guid actorId, Guid householdId, Guid invitationId, CancellationToken ct) => store.RevokeInvitationAsync(actorId, householdId, invitationId, ct);

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
        var code = SecureTokenUtils.GenerateHex(24);
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
