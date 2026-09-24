using InOut.Application.Security;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Security;

public sealed class EfHouseholdMembershipReader(InOutDbContext dbContext)
    : IHouseholdMembershipReader
{
    public async Task<bool> IsMemberAsync(
        Guid userId,
        Guid householdId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(
            userId,
            cancellationToken);
        var isMember = await dbContext.HouseholdMembers
            .AsNoTracking()
            .AnyAsync(
                member => member.HouseholdId == householdId && member.UserId == userId,
                cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return isMember;
    }
}
