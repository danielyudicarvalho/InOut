using System.Security.Claims;
using InOut.Api.Security;
using InOut.Application.Financial.Forecasts;
using Microsoft.AspNetCore.Mvc;

namespace InOut.Api.Financial;

public sealed record CreateForecastRequest(Guid AccountId, DateOnly AsOf, int Months);

public static class ForecastEndpoints
{
    public static IEndpointRouteBuilder MapForecastEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var forecasts = endpoints.MapGroup("/api/v1/households/{householdId:guid}/forecasts")
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithTags("Forecasts");

        forecasts.MapPost("/", async (Guid householdId, CreateForecastRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, ForecastService service, CancellationToken cancellationToken) =>
        {
            var result = await service.CreateAsync(householdId, request.AccountId,
                request.AsOf, request.Months, UserId(principal), idempotencyKey,
                cancellationToken);
            return result.Replayed ? Results.Ok(result) : Results.Created(
                $"/api/v1/households/{householdId}/forecasts/{result.Id}", result);
        }).WithName("CreateForecast");

        forecasts.MapGet("/", async (Guid householdId, ClaimsPrincipal principal,
            ForecastService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ListAsync(householdId, UserId(principal), cancellationToken)))
            .WithName("ListForecasts");

        forecasts.MapGet("/{forecastId:guid}", async (Guid householdId, Guid forecastId,
            ClaimsPrincipal principal, ForecastService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.GetAsync(householdId, forecastId,
                UserId(principal), cancellationToken)))
            .WithName("GetForecast");

        return endpoints;
    }

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ApiContract.Claims.Subject)!);
}
