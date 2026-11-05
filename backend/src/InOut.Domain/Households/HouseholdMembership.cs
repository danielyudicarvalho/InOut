namespace InOut.Domain.Households;

public sealed record HouseholdMembership(Guid UserId, HouseholdRole Role)
{
    public static void EnsureOwner(HouseholdRole? actorRole)
    {
        if (actorRole != HouseholdRole.Owner)
            throw new HouseholdRuleException(HouseholdErrorCodes.OwnerRequired, "Only a responsible member can manage collaboration.");
    }

    public void EnsureCanChangeRole(HouseholdRole? actorRole, HouseholdRole newRole, int ownerCount)
    {
        EnsureOwner(actorRole);
        if (!Enum.IsDefined(newRole))
            throw new HouseholdRuleException(HouseholdErrorCodes.InvalidRole, "Unknown household role.");
        EnsureOwnerRemains(newRole == HouseholdRole.Owner, ownerCount);
    }

    public void EnsureCanRemove(Guid actorId, HouseholdRole? actorRole, int ownerCount)
    {
        if (actorId != UserId) EnsureOwner(actorRole);
        EnsureOwnerRemains(false, ownerCount);
    }

    private void EnsureOwnerRemains(bool staysOwner, int ownerCount)
    {
        if (Role == HouseholdRole.Owner && !staysOwner && ownerCount <= 1)
            throw new HouseholdRuleException(HouseholdErrorCodes.LastOwner, "Promote another participant before leaving, removal or demotion of the last responsible member.");
    }
}
