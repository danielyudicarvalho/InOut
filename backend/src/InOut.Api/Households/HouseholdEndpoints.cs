using System.Security.Claims;
using InOut.Api.Security;
using InOut.Application.Households;

namespace InOut.Api.Households;

public static class HouseholdEndpoints
{
    public static IEndpointRouteBuilder MapHouseholdEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var households = endpoints.MapGroup("/api/v1/households")
            .RequireAuthorization()
            .WithTags("Households");

        households.MapGet("/", async (
            ClaimsPrincipal principal,
            HouseholdService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.ListAsync(UserId(principal), cancellationToken)))
            .WithName("ListHouseholds");

        households.MapPost("/", async (
            CreateHouseholdRequest request,
            ClaimsPrincipal principal,
            HouseholdService service,
            CancellationToken cancellationToken) =>
        {
            var household = await service.CreateAsync(
                UserId(principal), request.Name, cancellationToken);
            return Results.Created($"/api/v1/households/{household.Id}", household);
        })
            .WithName("CreateHousehold");

        households.MapPost("/{householdId:guid}/invitations", async (
            Guid householdId,
            ClaimsPrincipal principal,
            HouseholdService service,
            CancellationToken cancellationToken) =>
            Results.Created(
                $"/api/v1/households/{householdId}/invitations",
                await service.CreateInvitationAsync(
                    UserId(principal), householdId, cancellationToken)))
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithName("CreateHouseholdInvitation");

        endpoints.MapPost("/api/v1/household-invitations/accept", async (
            AcceptHouseholdInvitationRequest request,
            ClaimsPrincipal principal,
            HouseholdService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.AcceptInvitationAsync(
                UserId(principal), request.Code, cancellationToken)))
            .RequireAuthorization()
            .WithTags("Households")
            .WithName("AcceptHouseholdInvitation");

        return endpoints;
    }

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue("sub")!);

    public sealed record CreateHouseholdRequest(string? Name);
    public sealed record AcceptHouseholdInvitationRequest(string? Code);
}
