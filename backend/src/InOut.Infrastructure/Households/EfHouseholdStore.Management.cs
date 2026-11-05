using InOut.Application.Households;
using InOut.Domain.Households;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Households;

public sealed partial class EfHouseholdStore
{
    private async Task<HouseholdMemberRecord> RequireMemberAsync(Guid actorId, Guid householdId, CancellationToken ct) =>
        await dbContext.HouseholdMembers.SingleOrDefaultAsync(m => m.HouseholdId == householdId && m.UserId == actorId, ct)
        ?? throw new HouseholdRuleException(HouseholdErrorCodes.MembershipRequired, "Household access is no longer available.");

    public async Task<HouseholdContext> GetContextAsync(Guid actorId, Guid householdId, CancellationToken ct)
    {
        await using var tx = await dbContext.BeginUserTransactionAsync(actorId, ct);
        var actor = await RequireMemberAsync(actorId, householdId, ct);
        var household = await dbContext.Households.AsNoTracking().SingleAsync(h => h.Id == householdId, ct);
        var members = await dbContext.HouseholdMembers.AsNoTracking().Where(m => m.HouseholdId == householdId)
            .OrderBy(m => m.JoinedAt).Select(m => new HouseholdMemberSummary(m.UserId, m.Role, m.JoinedAt)).ToArrayAsync(ct);
        await tx.CommitAsync(ct);
        return new HouseholdContext(household.Id, household.Name, actorId, actor.Role, HouseholdRules.MaximumMembers, members);
    }

    public async Task<IReadOnlyList<InvitationSummary>> ListInvitationsAsync(Guid actorId, Guid householdId, CancellationToken ct)
    {
        await using var tx = await dbContext.BeginUserTransactionAsync(actorId, ct);
        HouseholdMembership.EnsureOwner((await RequireMemberAsync(actorId, householdId, ct)).Role);
        var rows = await dbContext.HouseholdInvitations.AsNoTracking().Where(i => i.HouseholdId == householdId)
            .OrderByDescending(i => i.CreatedAt).Take(50)
            .Select(i => new InvitationSummary(i.Id, i.CreatedAt, i.ExpiresAt, i.AcceptedAt, i.RevokedAt)).ToArrayAsync(ct);
        await tx.CommitAsync(ct);
        return rows;
    }

    public async Task ChangeRoleAsync(Guid actorId, Guid householdId, Guid memberId, HouseholdRole role, CancellationToken ct)
    {
        await using var tx = await dbContext.BeginUserTransactionAsync(actorId, ct);
        await LockHouseholdAsync(householdId, ct);
        var actor = await RequireMemberAsync(actorId, householdId, ct);
        var target = await dbContext.HouseholdMembers.SingleOrDefaultAsync(m => m.HouseholdId == householdId && m.UserId == memberId, ct)
            ?? throw new HouseholdRuleException(HouseholdErrorCodes.MemberNotFound, "Member was not found.");
        var owners = await dbContext.HouseholdMembers.CountAsync(m => m.HouseholdId == householdId && m.Role == HouseholdRole.Owner, ct);
        new HouseholdMembership(target.UserId, target.Role).EnsureCanChangeRole(actor.Role, role, owners);
        if (target.Role != role)
        {
            AddAudit(householdId, actorId, "household.member.role_changed", "household_member", memberId);
            await dbContext.SaveChangesAsync(ct);
            if (target.Role == HouseholdRole.Owner && role != HouseholdRole.Owner)
                await dbContext.HouseholdInvitations.Where(i => i.HouseholdId == householdId && i.CreatedBy == memberId && i.AcceptedAt == null && i.RevokedAt == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(i => i.RevokedAt, DateTimeOffset.UtcNow), ct);
            target.Role = role;
            await dbContext.SaveChangesAsync(ct);
        }
        await tx.CommitAsync(ct);
    }

    public async Task RemoveMemberAsync(Guid actorId, Guid householdId, Guid memberId, CancellationToken ct)
    {
        await using var tx = await dbContext.BeginUserTransactionAsync(actorId, ct);
        await LockHouseholdAsync(householdId, ct);
        var actor = await RequireMemberAsync(actorId, householdId, ct);
        var target = await dbContext.HouseholdMembers.SingleOrDefaultAsync(m => m.HouseholdId == householdId && m.UserId == memberId, ct)
            ?? throw new HouseholdRuleException(HouseholdErrorCodes.MemberNotFound, "Member was not found.");
        var owners = await dbContext.HouseholdMembers.CountAsync(m => m.HouseholdId == householdId && m.Role == HouseholdRole.Owner, ct);
        new HouseholdMembership(target.UserId, target.Role).EnsureCanRemove(actorId, actor.Role, owners);
        AddAudit(householdId, actorId, actorId == memberId ? "household.member.left" : "household.member.removed", "household_member", memberId);
        await dbContext.SaveChangesAsync(ct);
        // Revoking outstanding invitations prevents a removed responsible member's code from restoring access.
        if (actor.Role == HouseholdRole.Owner)
            await dbContext.HouseholdInvitations.Where(i => i.HouseholdId == householdId && i.CreatedBy == memberId && i.AcceptedAt == null && i.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.RevokedAt, DateTimeOffset.UtcNow), ct);
        dbContext.HouseholdMembers.Remove(target);
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task RevokeInvitationAsync(Guid actorId, Guid householdId, Guid invitationId, CancellationToken ct)
    {
        await using var tx = await dbContext.BeginUserTransactionAsync(actorId, ct);
        await LockHouseholdAsync(householdId, ct);
        HouseholdMembership.EnsureOwner((await RequireMemberAsync(actorId, householdId, ct)).Role);
        var invitation = await dbContext.HouseholdInvitations.SingleOrDefaultAsync(i => i.HouseholdId == householdId && i.Id == invitationId, ct)
            ?? throw new HouseholdRuleException(HouseholdErrorCodes.InvalidInvite, "Invitation was not found.");
        if (invitation.AcceptedAt == null && invitation.RevokedAt == null)
        {
            invitation.RevokedAt = DateTimeOffset.UtcNow;
            AddAudit(householdId, actorId, "household.invitation.revoked", "household_invitation", invitationId);
            await dbContext.SaveChangesAsync(ct);
        }
        await tx.CommitAsync(ct);
    }
}
