using InOut.Domain.Households;
using Xunit;
namespace InOut.Domain.Tests;
public sealed class HouseholdMembershipTests
{
    [Fact] public void LastResponsibleCannotLeaveBeRemovedOrDemoted()
    {
        var id = Guid.NewGuid();
        var owner = new HouseholdMembership(id, HouseholdRole.Owner);
        Assert.Throws<HouseholdRuleException>(() => owner.EnsureCanRemove(id, HouseholdRole.Owner, 1));
        Assert.Throws<HouseholdRuleException>(() => owner.EnsureCanRemove(Guid.NewGuid(), HouseholdRole.Owner, 1));
        Assert.Throws<HouseholdRuleException>(() => owner.EnsureCanChangeRole(HouseholdRole.Owner, HouseholdRole.Member, 1));
        owner.EnsureCanRemove(id, HouseholdRole.Owner, 2);
        owner.EnsureCanChangeRole(HouseholdRole.Owner, HouseholdRole.Member, 2);
    }
    [Fact] public void MemberCanLeaveButCannotPromoteOrRemoveOthers()
    {
        var id = Guid.NewGuid();
        var member = new HouseholdMembership(id, HouseholdRole.Member);
        member.EnsureCanRemove(id, HouseholdRole.Member, 1);
        Assert.Throws<HouseholdRuleException>(() => member.EnsureCanRemove(Guid.NewGuid(), HouseholdRole.Member, 1));
        Assert.Throws<HouseholdRuleException>(() => member.EnsureCanChangeRole(HouseholdRole.Member, HouseholdRole.Owner, 1));
        Assert.Throws<HouseholdRuleException>(() => HouseholdMembership.EnsureOwner(null));
    }
}
