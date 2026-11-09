using System.Security.Claims;
using InOut.Api.Security;
using InOut.Application.Financial.Planning;
using InOut.Domain.Financial;
using Microsoft.AspNetCore.Mvc;

namespace InOut.Api.Financial;

public sealed record CreateGoalRequest(
    Guid Id, string Name, long TargetCents, string Currency, DateOnly? TargetDate);

public sealed record UpdateGoalRequest(string Name, long TargetCents, DateOnly? TargetDate);

public sealed record ChangeGoalStatusRequest(string Status);

public sealed record ProjectLineRequest(Guid Id, string Name, FinancialFlow Flow, long AmountCents);

public sealed record CreateProjectRequest(
    Guid Id, string Name, string Currency, long PlannedCents, DateOnly StartsOn, DateOnly? EndsOn,
    string? Notes, IReadOnlyList<ProjectLineRequest>? Lines);

public sealed record UpdateProjectRequest(
    string Name, long PlannedCents, DateOnly StartsOn, DateOnly? EndsOn,
    string? Notes, IReadOnlyList<ProjectLineRequest>? Lines);

public sealed record LinkProjectMovementRequest(Guid TransactionId);

public static class PlanningEndpoints
{
    public static IEndpointRouteBuilder MapPlanningEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var ledger = endpoints.MapGroup("/api/v1/households/{householdId:guid}/ledger")
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithTags("Planning");

        ledger.MapGet("/budgets", async (Guid householdId, DateOnly from, DateOnly to,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ListBudgetsAsync(UserId(principal), householdId, from, to, cancellationToken)))
            .WithName("ListBudgets");

        ledger.MapGet("/budgets/{budgetId:guid}", async (Guid householdId, Guid budgetId,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.GetBudgetAsync(UserId(principal), householdId, budgetId, cancellationToken)))
            .WithName("GetBudget");

        ledger.MapGet("/goals", async (Guid householdId, ClaimsPrincipal principal,
            PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ListGoalsAsync(UserId(principal), householdId, cancellationToken)))
            .WithName("ListGoals");

        ledger.MapGet("/goals/{goalId:guid}", async (Guid householdId, Guid goalId,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.GetGoalAsync(UserId(principal), householdId, goalId, cancellationToken)))
            .WithName("GetGoal");

        ledger.MapPost("/goals", async (Guid householdId, CreateGoalRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
        {
            var result = await service.CreateGoalAsync(UserId(principal), new CreateGoalCommand(
                request.Id, householdId, request.Name, request.TargetCents, request.Currency,
                request.TargetDate, idempotencyKey), cancellationToken);
            return result.Replayed ? Results.Ok(result) : Results.Created(
                $"/api/v1/households/{householdId}/ledger/goals/{result.Id}", result);
        }).WithName("CreateGoal");

        ledger.MapPut("/goals/{goalId:guid}", async (Guid householdId, Guid goalId, UpdateGoalRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.UpdateGoalAsync(UserId(principal), new UpdateGoalCommand(
                householdId, goalId, request.Name, request.TargetCents, request.TargetDate, idempotencyKey),
                cancellationToken)))
            .WithName("UpdateGoal");

        ledger.MapPost("/goals/{goalId:guid}/status", async (Guid householdId, Guid goalId,
            ChangeGoalStatusRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ChangeGoalStatusAsync(UserId(principal), new ChangeGoalStatusCommand(
                householdId, goalId, request.Status, idempotencyKey), cancellationToken)))
            .WithName("ChangeGoalStatus");

        var projects = endpoints.MapGroup("/api/v1/households/{householdId:guid}/projects")
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithTags("Projects");

        projects.MapGet("/", async (Guid householdId, ClaimsPrincipal principal,
            PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ListProjectsAsync(UserId(principal), householdId, cancellationToken)))
            .WithName("ListProjects");

        projects.MapGet("/{projectId:guid}", async (Guid householdId, Guid projectId,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.GetProjectAsync(UserId(principal), householdId, projectId, cancellationToken)))
            .WithName("GetProject");

        projects.MapPost("/", async (Guid householdId, CreateProjectRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
        {
            var result = await service.CreateProjectAsync(UserId(principal), new CreateProjectCommand(
                request.Id, householdId, request.Name, request.Currency, request.PlannedCents,
                request.StartsOn, request.EndsOn, request.Notes, Lines(request.Lines), idempotencyKey), cancellationToken);
            return result.Replayed ? Results.Ok(result) : Results.Created(
                $"/api/v1/households/{householdId}/projects/{result.Id}", result);
        }).WithName("CreateProject");

        projects.MapPut("/{projectId:guid}", async (Guid householdId, Guid projectId, UpdateProjectRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.UpdateProjectAsync(UserId(principal), new UpdateProjectCommand(
                householdId, projectId, request.Name, request.PlannedCents, request.StartsOn, request.EndsOn,
                request.Notes, Lines(request.Lines), idempotencyKey), cancellationToken)))
            .WithName("UpdateProject");

        projects.MapPost("/{projectId:guid}/close", async (Guid householdId, Guid projectId,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.CloseProjectAsync(UserId(principal),
                new CloseProjectCommand(householdId, projectId, idempotencyKey), cancellationToken)))
            .WithName("CloseProject");

        projects.MapPost("/{projectId:guid}/movements", async (Guid householdId, Guid projectId,
            LinkProjectMovementRequest request,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.LinkMovementAsync(UserId(principal), new LinkProjectMovementCommand(
                householdId, projectId, request.TransactionId, idempotencyKey), cancellationToken)))
            .WithName("LinkProjectMovement");

        projects.MapDelete("/{projectId:guid}/movements/{transactionId:guid}", async (
            Guid householdId, Guid projectId, Guid transactionId,
            [FromHeader(Name = ApiContract.Headers.IdempotencyKey)] Guid idempotencyKey,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.UnlinkMovementAsync(UserId(principal), new LinkProjectMovementCommand(
                householdId, projectId, transactionId, idempotencyKey), cancellationToken)))
            .WithName("UnlinkProjectMovement");

        var agenda = endpoints.MapGroup("/api/v1/households/{householdId:guid}/agenda")
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithTags("Agenda");
        agenda.MapGet("/", async (Guid householdId, DateOnly from, DateOnly to, ClaimsPrincipal principal,
            PlanningService service, TimeProvider time, CancellationToken cancellationToken) =>
            Results.Ok(await service.AgendaAsync(UserId(principal), householdId, from, to,
                DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime), cancellationToken)))
            .WithName("GetAgenda");

        var forecasts = endpoints.MapGroup("/api/v1/households/{householdId:guid}/forecasts")
            .RequireAuthorization(HouseholdMemberRequirement.PolicyName)
            .WithTags("Forecasts");
        forecasts.MapGet("/{forecastId:guid}/comparison", async (Guid householdId, Guid forecastId,
            ClaimsPrincipal principal, PlanningService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.CompareForecastAsync(UserId(principal), householdId, forecastId, cancellationToken)))
            .WithName("CompareForecast");

        return endpoints;
    }

    private static ProjectLine[] Lines(IReadOnlyList<ProjectLineRequest>? lines) =>
        lines?.Select(line => new ProjectLine(line.Id, line.Name, line.Flow, line.AmountCents)).ToArray() ?? [];

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ApiContract.Claims.Subject)!);
}
