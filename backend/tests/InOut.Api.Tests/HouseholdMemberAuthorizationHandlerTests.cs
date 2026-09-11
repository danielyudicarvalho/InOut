using System.Security.Claims;
using InOut.Api.Security;
using InOut.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace InOut.Api.Tests;

public sealed class HouseholdMemberAuthorizationHandlerTests
{
    [Fact]
    public async Task AllowsARecordedHouseholdMember()
    {
        var userId = Guid.NewGuid();
        var householdId = Guid.NewGuid();
        var context = CreateContext(userId, householdId);
        var handler = new HouseholdMemberAuthorizationHandler(
            new StubMembershipReader(userId, householdId));

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task DeniesCrossHouseholdAccessEvenWhenHouseholdIdComesFromRoute()
    {
        var userId = Guid.NewGuid();
        var context = CreateContext(userId, Guid.NewGuid());
        var handler = new HouseholdMemberAuthorizationHandler(
            new StubMembershipReader(userId, Guid.NewGuid()));

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    private static AuthorizationHandlerContext CreateContext(Guid userId, Guid householdId)
    {
        var principal = new ClaimsPrincipal(
            new ClaimsIdentity([new Claim("sub", userId.ToString())], "test"));
        var httpContext = new DefaultHttpContext();
        httpContext.Request.RouteValues["householdId"] = householdId;
        return new AuthorizationHandlerContext(
            [new HouseholdMemberRequirement()], principal, httpContext);
    }

    private sealed class StubMembershipReader(Guid allowedUserId, Guid allowedHouseholdId)
        : IHouseholdMembershipReader
    {
        public Task<bool> IsMemberAsync(
            Guid userId,
            Guid householdId,
            CancellationToken cancellationToken) =>
            Task.FromResult(userId == allowedUserId && householdId == allowedHouseholdId);
    }
}
