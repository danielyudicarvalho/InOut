using System.Security.Claims;
using InOut.Api.Security;
using InOut.Application.Households;

namespace InOut.Api.Households;

public static class HouseholdEndpoints
{
    public static IEndpointRouteBuilder MapHouseholdEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var households = endpoints.MapGroup(ApiContract.Routes.Households)
            .RequireAuthorization()
            .WithTags(ApiContract.Tags.Households);

        households.MapGet(ApiContract.Routes.Root, async (
            ClaimsPrincipal principal,
            HouseholdService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.ListAsync(UserId(principal), cancellationToken)))
            .WithName(ApiContract.EndpointNames.ListHouseholds);

        households.MapPost(ApiContract.Routes.Root, async (
            CreateHouseholdRequest request,
            ClaimsPrincipal principal,
            HouseholdService service,
            CancellationToken cancellationToken) =>
        {
            var household = await service.CreateAsync(
                UserId(principal), request.Name, cancellationToken);
            return Results.Created(ApiContract.Routes.HouseholdResource(household.Id), household);
        })
            .WithName(ApiContract.EndpointNames.CreateHousehold);

        households.MapPost(ApiContract.Routes.HouseholdInvitations, async (
            Guid householdId,
            ClaimsPrincipal principal,
            HouseholdService service,
            CancellationToken cancellationToken) =>
            Results.Created(
                ApiContract.Routes.InvitationResource(householdId),
                await service.CreateInvitationAsync(
                    UserId(principal), householdId, cancellationToken)))
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithName(ApiContract.EndpointNames.CreateHouseholdInvitation);

        endpoints.MapPost(ApiContract.Routes.AcceptInvitation, async (
            AcceptHouseholdInvitationRequest request,
            ClaimsPrincipal principal,
            HouseholdService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.AcceptInvitationAsync(
                UserId(principal), request.Code, cancellationToken)))
            .RequireAuthorization()
            .WithTags(ApiContract.Tags.Households)
            .WithName(ApiContract.EndpointNames.AcceptHouseholdInvitation);

        return endpoints;
    }

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ApiContract.Claims.Subject)!);
}
