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
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select set_config('request.jwt.claim.sub', {userId.ToString()}, true)",
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
