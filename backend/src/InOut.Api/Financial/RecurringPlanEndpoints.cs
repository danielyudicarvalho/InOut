using System.Security.Claims;
using InOut.Api.Security;
using InOut.Application.Financial.RecurringPlans;
using InOut.Domain.Financial;
using Microsoft.AspNetCore.Mvc;

namespace InOut.Api.Financial;

public sealed record CreateRecurringPlanRequest(
    Guid Id, string Name, FinancialFlow Flow, Guid AccountId, Guid CategoryId,
    Guid? IncomeSourceId, long AmountCents, string Currency,
    int DayOfMonth, DateOnly StartsOn, DateOnly? EndsOn);

public sealed record ChangeRecurringPlanStatusRequest(RecurringPlanStatus Status);

public static class RecurringPlanEndpoints
{
    public static IEndpointRouteBuilder MapRecurringPlanEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var plans = endpoints.MapGroup("/api/v1/households/{householdId:guid}/recurring-plans")
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithTags("Recurring plans");

        plans.MapPost("/", async (
            Guid householdId, CreateRecurringPlanRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, RecurringPlanService service, CancellationToken cancellationToken) =>
        {
            var result = await service.CreateAsync(UserId(principal), new CreateRecurringPlanCommand(
                request.Id, householdId, request.Name, request.Flow, request.AccountId,
                request.CategoryId, request.IncomeSourceId, request.AmountCents,
                request.Currency, request.DayOfMonth, request.StartsOn, request.EndsOn,
                idempotencyKey), cancellationToken);
            return result.Replayed ? Results.Ok(result) : Results.Created(
                $"/api/v1/households/{householdId}/recurring-plans/{result.Id}", result);
        }).WithName("CreateRecurringPlan");

        plans.MapGet("/", async (Guid householdId, ClaimsPrincipal principal,
            RecurringPlanService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ListAsync(householdId, UserId(principal), cancellationToken)))
            .WithName("ListRecurringPlans");

        plans.MapGet("/{planId:guid}", async (Guid householdId, Guid planId,
            ClaimsPrincipal principal, RecurringPlanService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.GetAsync(householdId, planId, UserId(principal), cancellationToken)))
            .WithName("GetRecurringPlan");

        plans.MapGet("/{planId:guid}/preview", async (Guid householdId, Guid planId,
            DateOnly from, int? count, ClaimsPrincipal principal,
            RecurringPlanService service, CancellationToken cancellationToken) =>
        {
            var plan = await service.GetAsync(householdId, planId, UserId(principal), cancellationToken);
            return Results.Ok(RecurringPlanService.Preview(plan, from, count ?? 6));
        }).WithName("PreviewRecurringPlan");

        plans.MapPatch("/{planId:guid}/status", async (Guid householdId, Guid planId,
            ChangeRecurringPlanStatusRequest request, ClaimsPrincipal principal,
            RecurringPlanService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ChangeStatusAsync(householdId, planId,
                request.Status, UserId(principal), cancellationToken)))
            .WithName("ChangeRecurringPlanStatus");

        return endpoints;
    }

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ApiContract.Claims.Subject)!);
}
