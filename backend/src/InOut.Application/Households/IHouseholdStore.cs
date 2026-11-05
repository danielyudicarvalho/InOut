using InOut.Domain.Households;

namespace InOut.Application.Households;

public sealed record HouseholdMemberSummary(Guid UserId, HouseholdRole Role, DateTimeOffset JoinedAt);
public sealed record HouseholdContext(Guid Id, string Name, Guid ActorId, HouseholdRole Role, int MaximumMembers, IReadOnlyList<HouseholdMemberSummary> Members);
public sealed record InvitationSummary(Guid Id, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, DateTimeOffset? AcceptedAt, DateTimeOffset? RevokedAt);

public interface IHouseholdStore
{
    Task<HouseholdContext> GetContextAsync(Guid actorId, Guid householdId, CancellationToken cancellationToken);
    Task<IReadOnlyList<InvitationSummary>> ListInvitationsAsync(Guid actorId, Guid householdId, CancellationToken cancellationToken);
    Task ChangeRoleAsync(Guid actorId, Guid householdId, Guid memberId, HouseholdRole role, CancellationToken cancellationToken);
    Task RemoveMemberAsync(Guid actorId, Guid householdId, Guid memberId, CancellationToken cancellationToken);
    Task RevokeInvitationAsync(Guid actorId, Guid householdId, Guid invitationId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Household>> ListAsync(Guid userId, CancellationToken cancellationToken);
    Task<Household> CreateAsync(Guid userId, string name, CancellationToken cancellationToken);
    Task SaveInvitationAsync(
        Guid userId,
        Guid householdId,
        byte[] tokenHash,
        DateTimeOffset expiresAt,
        CancellationToken cancellationToken);
    Task<Household> AcceptInvitationAsync(
        Guid userId,
        byte[] tokenHash,
        CancellationToken cancellationToken);
}
