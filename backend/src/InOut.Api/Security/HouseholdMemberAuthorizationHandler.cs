using System.Security.Claims;
using InOut.Application.Security;
using Microsoft.AspNetCore.Authorization;

namespace InOut.Api.Security;

public sealed class HouseholdMemberAuthorizationHandler(
    IHouseholdMembershipReader membershipReader)
    : AuthorizationHandler<HouseholdMemberRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        HouseholdMemberRequirement requirement)
    {
        if (context.Resource is not HttpContext httpContext ||
            !Guid.TryParse(context.User.FindFirstValue(ApiContract.Claims.Subject), out var userId) ||
            !Guid.TryParse(
                httpContext.Request.RouteValues[ApiContract.RouteValues.HouseholdId]?.ToString(),
                out var householdId))
        {
            return;
        }

        if (await membershipReader.IsMemberAsync(userId, householdId, httpContext.RequestAborted))
        {
            context.Succeed(requirement);
        }
    }
}
