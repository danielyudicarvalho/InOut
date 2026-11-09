using InOut.Api.Diagnostics;
using System.Security.Claims;
using InOut.Api.Security;
using InOut.Application.Households;
using InOut.Domain.Households;

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
            .WithName(ApiContract.EndpointNames.CreateHousehold)
            .TrackProductEvent("household_created", new ProductEventOptions
            {
                HouseholdFromResult = value => (value as Household)?.Id,
                MemberCountAfter = 1,
            });

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
            .WithName(ApiContract.EndpointNames.CreateHouseholdInvitation)
            .TrackProductEvent("household_invitation_created");

        endpoints.MapPost(ApiContract.Routes.AcceptInvitation, async (
            AcceptHouseholdInvitationRequest request,
            ClaimsPrincipal principal,
            HouseholdService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.AcceptInvitationAsync(
                UserId(principal), request.Code, cancellationToken)))
            .RequireAuthorization()
            .WithTags(ApiContract.Tags.Households)
            .WithName(ApiContract.EndpointNames.AcceptHouseholdInvitation)
            .TrackProductEvent("household_invitation_accepted", new ProductEventOptions
            {
                HouseholdFromResult = value => (value as Household)?.Id,
                MemberCountAfter = 2,
            });

        households.MapGet("/{householdId:guid}/context", async (Guid householdId, ClaimsPrincipal principal, HouseholdService service, CancellationToken ct) =>
            Results.Ok(await service.GetContextAsync(UserId(principal), householdId, ct)));
        households.MapGet("/{householdId:guid}/invitations", async (Guid householdId, ClaimsPrincipal principal, HouseholdService service, CancellationToken ct) =>
            Results.Ok(await service.ListInvitationsAsync(UserId(principal), householdId, ct)));
        households.MapPut("/{householdId:guid}/members/{memberId:guid}/role", async Task<IResult> (Guid householdId, Guid memberId, ChangeHouseholdRoleRequest request, ClaimsPrincipal principal, HouseholdService service, CancellationToken ct) =>
        {
            if (request.Role is not { } role) return Results.BadRequest(new { code = "invalid_household_role" });
            await service.ChangeRoleAsync(UserId(principal), householdId, memberId, role, ct);
            return Results.NoContent();
        });
        households.MapDelete("/{householdId:guid}/members/{memberId:guid}", async Task<IResult> (Guid householdId, Guid memberId, ClaimsPrincipal principal, HouseholdService service, CancellationToken ct) =>
        {
            if (memberId == UserId(principal)) return Results.BadRequest();
            await service.RemoveMemberAsync(UserId(principal), householdId, memberId, ct);
            return Results.NoContent();
        });
        households.MapPost("/{householdId:guid}/leave", async (Guid householdId, ClaimsPrincipal principal, HouseholdService service, CancellationToken ct) =>
        {
            await service.RemoveMemberAsync(UserId(principal), householdId, UserId(principal), ct);
            return Results.NoContent();
        })
            // Households hold at most two members and the last owner cannot leave.
            .TrackProductEvent("household_member_left", new ProductEventOptions { MemberCountAfter = 1 });
        households.MapDelete("/{householdId:guid}/invitations/{invitationId:guid}", async (Guid householdId, Guid invitationId, ClaimsPrincipal principal, HouseholdService service, CancellationToken ct) =>
        {
            await service.RevokeInvitationAsync(UserId(principal), householdId, invitationId, ct);
            return Results.NoContent();
        });

        return endpoints;
    }

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ApiContract.Claims.Subject)!);
}
