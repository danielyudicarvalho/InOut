using InOut.Application.Households;
using InOut.Domain.Households;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace InOut.Infrastructure.Households;

public sealed class EfHouseholdStore(InOutDbContext dbContext) : IHouseholdStore
{
    public async Task<IReadOnlyList<Household>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await BeginForUserAsync(userId, cancellationToken);
        var households = await dbContext.HouseholdMembers
            .AsNoTracking()
            .Where(member => member.UserId == userId)
            .OrderBy(member => member.Household.Name)
            .Select(member => new Household(member.Household.Id, member.Household.Name))
            .ToListAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return households;
    }

    public async Task<Household> CreateAsync(
        Guid userId,
        string name,
        CancellationToken cancellationToken)
    {
        await using var transaction = await BeginForUserAsync(userId, cancellationToken);
        var household = new HouseholdRecord
        {
            Id = Guid.NewGuid(),
            Name = name,
            CreatedBy = userId,
        };
        dbContext.Households.Add(household);
        dbContext.HouseholdMembers.Add(new HouseholdMemberRecord
        {
            HouseholdId = household.Id,
            UserId = userId,
            Role = "owner",
            Household = household,
        });
        AddAudit(household.Id, userId, "household.created", "household", household.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new Household(household.Id, household.Name);
    }

    public async Task SaveInvitationAsync(
        Guid userId,
        Guid householdId,
        byte[] tokenHash,
        DateTimeOffset expiresAt,
        CancellationToken cancellationToken)
    {
        await using var transaction = await BeginForUserAsync(userId, cancellationToken);
        await LockHouseholdAsync(householdId, cancellationToken);

        var role = await dbContext.HouseholdMembers
            .Where(member => member.HouseholdId == householdId && member.UserId == userId)
            .Select(member => member.Role)
            .SingleOrDefaultAsync(cancellationToken);
        if (!string.Equals(role, "owner", StringComparison.Ordinal))
        {
            throw new HouseholdRuleException("owner_required", "Only a household owner can create an invitation.");
        }

        var memberCount = await dbContext.HouseholdMembers
            .CountAsync(member => member.HouseholdId == householdId, cancellationToken);
        if (memberCount >= HouseholdRules.MaximumMembers)
        {
            throw new HouseholdRuleException("household_full", "Household already has two members.");
        }

        await dbContext.HouseholdInvitations
            .Where(invitation => invitation.HouseholdId == householdId && invitation.AcceptedAt == null)
            .ExecuteDeleteAsync(cancellationToken);

        var invitation = new HouseholdInvitationRecord
        {
            Id = Guid.NewGuid(),
            HouseholdId = householdId,
            TokenHash = tokenHash,
            CreatedBy = userId,
            ExpiresAt = expiresAt,
        };
        dbContext.HouseholdInvitations.Add(invitation);
        AddAudit(
            householdId,
            userId,
            "household.invitation.created",
            "household_invitation",
            invitation.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<Household> AcceptInvitationAsync(
        Guid userId,
        byte[] tokenHash,
        CancellationToken cancellationToken)
    {
        await using var transaction = await BeginForUserAsync(userId, cancellationToken);
        var invitation = await dbContext.HouseholdInvitations
            .FromSqlInterpolated($$"""
                select *
                from private.household_invitations
                where token_hash = {{tokenHash}}
                  and accepted_at is null
                  and expires_at > now()
                for update
                """)
            .SingleOrDefaultAsync(cancellationToken);
        if (invitation is null)
        {
            throw new HouseholdRuleException("invalid_invite", "Invalid or expired invitation.");
        }

        var alreadyMember = await dbContext.HouseholdMembers.AnyAsync(
            member => member.HouseholdId == invitation.HouseholdId && member.UserId == userId,
            cancellationToken);
        if (alreadyMember)
        {
            throw new HouseholdRuleException("already_member", "User is already a household member.");
        }

        var memberCount = await dbContext.HouseholdMembers.CountAsync(
            member => member.HouseholdId == invitation.HouseholdId,
            cancellationToken);
        if (memberCount >= HouseholdRules.MaximumMembers)
        {
            throw new HouseholdRuleException("household_full", "Household already has two members.");
        }

        dbContext.HouseholdMembers.Add(new HouseholdMemberRecord
        {
            HouseholdId = invitation.HouseholdId,
            UserId = userId,
            Role = "member",
        });
        invitation.AcceptedBy = userId;
        invitation.AcceptedAt = DateTimeOffset.UtcNow;
        AddAudit(
            invitation.HouseholdId,
            userId,
            "household.invitation.accepted",
            "household_invitation",
            invitation.Id);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new HouseholdRuleException("already_member", "User is already a household member.");
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        { SqlState: PostgresErrorCodes.CheckViolation })
        {
            throw new HouseholdRuleException("household_full", "Household already has two members.");
        }

        var household = await dbContext.Households
            .AsNoTracking()
            .SingleAsync(item => item.Id == invitation.HouseholdId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new Household(household.Id, household.Name);
    }

    private async Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginForUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select set_config('request.jwt.claim.sub', {userId.ToString()}, true)",
            cancellationToken);
        return transaction;
    }

    private Task<int> LockHouseholdAsync(Guid householdId, CancellationToken cancellationToken) =>
        dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select id from public.households where id = {householdId} for update",
            cancellationToken);

    private void AddAudit(
        Guid householdId,
        Guid userId,
        string action,
        string entityType,
        Guid entityId) => dbContext.AuditEvents.Add(new AuditEventRecord
        {
            HouseholdId = householdId,
            ActorUserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
        });
}
