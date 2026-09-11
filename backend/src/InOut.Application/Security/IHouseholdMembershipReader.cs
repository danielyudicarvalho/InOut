namespace InOut.Application.Security;

public interface IHouseholdMembershipReader
{
    Task<bool> IsMemberAsync(Guid userId, Guid householdId, CancellationToken cancellationToken);
}
