using InOut.Domain.Households;

namespace InOut.Application.Households;

public interface IHouseholdStore
{
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
