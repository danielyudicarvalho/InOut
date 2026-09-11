using Microsoft.AspNetCore.Authorization;

namespace InOut.Api.Security;

public sealed class HouseholdMemberRequirement : IAuthorizationRequirement
{
    public const string PolicyName = "HouseholdMember";
}
