using InOut.Application.Idempotency;
using InOut.Domain.Financial;

namespace InOut.Application.Financial.Planning;

public sealed record BudgetView(
    Guid Id, Guid CategoryId, string CategoryName, DateOnly PeriodStart, DateOnly PeriodEnd,
    long LimitCents, long? SpentCents, long? RemainingCents, string? Currency);

public sealed record BudgetRevisionView(
    Guid Id, long? PreviousLimitCents, long LimitCents, string Currency,
    Guid CreatedBy, DateTimeOffset CreatedAt);

public sealed record BudgetDetail(BudgetView Budget, IReadOnlyList<BudgetRevisionView> Revisions, IReadOnlyList<BudgetExpenseLine> Expenses);

public sealed record GoalView(
    Guid Id, string Name, long TargetCents, long AllocatedCents, DateOnly? TargetDate,
    string? Currency, GoalStatus Status, DateTimeOffset? ArchivedAt, bool Replayed = false);

public sealed record GoalDetail(GoalView Goal, IReadOnlyList<GoalAllocationItem> Allocations);

public sealed record ProjectMovementView(Guid TransactionId, DateOnly OccurredOn, string? Description);

public sealed record ProjectView(
    Guid Id, string Name, string Currency, long PlannedCents, DateOnly StartsOn, DateOnly? EndsOn,
    string? Notes, FinancialProjectStatus Status, IReadOnlyList<ProjectLine> Lines,
    IReadOnlyList<ProjectMovementView> Movements, ProjectComparison Comparison, bool Replayed = false);

public sealed record CreateGoalCommand(
    Guid Id, Guid HouseholdId, string Name, long TargetCents, string Currency,
    DateOnly? TargetDate, Guid IdempotencyKey);

public sealed record UpdateGoalCommand(
    Guid HouseholdId, Guid GoalId, string Name, long TargetCents, DateOnly? TargetDate, Guid IdempotencyKey);

public sealed record ChangeGoalStatusCommand(
    Guid HouseholdId, Guid GoalId, string Status, Guid IdempotencyKey);

public sealed record CreateProjectCommand(
    Guid Id, Guid HouseholdId, string Name, string Currency, long PlannedCents,
    DateOnly StartsOn, DateOnly? EndsOn, string? Notes, IReadOnlyList<ProjectLine> Lines, Guid IdempotencyKey);

public sealed record UpdateProjectCommand(
    Guid HouseholdId, Guid ProjectId, string Name, long PlannedCents, DateOnly StartsOn,
    DateOnly? EndsOn, string? Notes, IReadOnlyList<ProjectLine> Lines, Guid IdempotencyKey);

public sealed record CloseProjectCommand(Guid HouseholdId, Guid ProjectId, Guid IdempotencyKey);

public sealed record LinkProjectMovementCommand(
    Guid HouseholdId, Guid ProjectId, Guid TransactionId, Guid IdempotencyKey);

public interface IPlanningStore
{
    Task<IReadOnlyList<BudgetView>> ListBudgetsAsync(Guid actorUserId, Guid householdId, DateOnly from, DateOnly until, CancellationToken cancellationToken);
    Task<BudgetDetail> GetBudgetAsync(Guid actorUserId, Guid householdId, Guid budgetId, CancellationToken cancellationToken);
    Task<IReadOnlyList<GoalView>> ListGoalsAsync(Guid actorUserId, Guid householdId, CancellationToken cancellationToken);
    Task<GoalDetail> GetGoalAsync(Guid actorUserId, Guid householdId, Guid goalId, CancellationToken cancellationToken);
    Task<GoalView> CreateGoalAsync(Guid actorUserId, CreateGoalCommand command, IdempotencyRequest identity, CancellationToken cancellationToken);
    Task<GoalView> UpdateGoalAsync(Guid actorUserId, UpdateGoalCommand command, IdempotencyRequest identity, CancellationToken cancellationToken);
    Task<GoalView> ChangeGoalStatusAsync(Guid actorUserId, ChangeGoalStatusCommand command, IdempotencyRequest identity, CancellationToken cancellationToken);
    Task<IReadOnlyList<ProjectView>> ListProjectsAsync(Guid actorUserId, Guid householdId, CancellationToken cancellationToken);
    Task<ProjectView> GetProjectAsync(Guid actorUserId, Guid householdId, Guid projectId, CancellationToken cancellationToken);
    Task<ProjectView> CreateProjectAsync(Guid actorUserId, CreateProjectCommand command, IdempotencyRequest identity, CancellationToken cancellationToken);
    Task<ProjectView> UpdateProjectAsync(Guid actorUserId, UpdateProjectCommand command, IdempotencyRequest identity, CancellationToken cancellationToken);
    Task<ProjectView> CloseProjectAsync(Guid actorUserId, CloseProjectCommand command, IdempotencyRequest identity, CancellationToken cancellationToken);
    Task<ProjectView> LinkMovementAsync(Guid actorUserId, LinkProjectMovementCommand command, IdempotencyRequest identity, CancellationToken cancellationToken);
    Task<ProjectView> UnlinkMovementAsync(Guid actorUserId, LinkProjectMovementCommand command, IdempotencyRequest identity, CancellationToken cancellationToken);
    Task<IReadOnlyList<AgendaItem>> AgendaAsync(Guid actorUserId, Guid householdId, DateOnly from, DateOnly until, DateOnly today, CancellationToken cancellationToken);
    Task<IReadOnlyList<ForecastComparisonPoint>> CompareForecastAsync(Guid actorUserId, Guid householdId, Guid forecastId, CancellationToken cancellationToken);
}

public sealed class PlanningService(IPlanningStore store)
{
    public Task<IReadOnlyList<BudgetView>> ListBudgetsAsync(
        Guid actorUserId, Guid householdId, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        EnsureRange(from, to);
        return store.ListBudgetsAsync(actorUserId, householdId, from, to, cancellationToken);
    }

    public Task<BudgetDetail> GetBudgetAsync(
        Guid actorUserId, Guid householdId, Guid budgetId, CancellationToken cancellationToken) =>
        store.GetBudgetAsync(actorUserId, householdId, budgetId, cancellationToken);

    public Task<IReadOnlyList<GoalView>> ListGoalsAsync(
        Guid actorUserId, Guid householdId, CancellationToken cancellationToken) =>
        store.ListGoalsAsync(actorUserId, householdId, cancellationToken);

    public Task<GoalDetail> GetGoalAsync(
        Guid actorUserId, Guid householdId, Guid goalId, CancellationToken cancellationToken) =>
        store.GetGoalAsync(actorUserId, householdId, goalId, cancellationToken);

    public Task<GoalView> CreateGoalAsync(
        Guid actorUserId, CreateGoalCommand command, CancellationToken cancellationToken)
    {
        var goal = Goal.Create(command.Id, command.HouseholdId, command.Name, command.TargetCents,
            command.TargetDate, actorUserId, command.Currency);
        var identity = IdempotencyRequest.Create(command.HouseholdId, actorUserId, IdempotencyOperation.CreateGoal,
            command.IdempotencyKey, command.Id, goal.Name, command.TargetCents, goal.Currency, command.TargetDate);
        return store.CreateGoalAsync(actorUserId, command with { Name = goal.Name, Currency = goal.Currency }, identity, cancellationToken);
    }

    public Task<GoalView> UpdateGoalAsync(
        Guid actorUserId, UpdateGoalCommand command, CancellationToken cancellationToken)
    {
        var name = Goal.NormalizeName(command.Name);
        if (command.TargetCents <= 0)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidAmount, "Goal target amount must be positive.");
        var identity = IdempotencyRequest.Create(command.HouseholdId, actorUserId, IdempotencyOperation.UpdateGoal,
            command.IdempotencyKey, command.GoalId, name, command.TargetCents, command.TargetDate);
        return store.UpdateGoalAsync(actorUserId, command with { Name = name }, identity, cancellationToken);
    }

    public Task<GoalView> ChangeGoalStatusAsync(
        Guid actorUserId, ChangeGoalStatusCommand command, CancellationToken cancellationToken)
    {
        if (command.Status is not ("active" or "paused" or "completed" or "archived"))
            throw new FinancialRuleException(FinancialErrorCodes.InvalidGoalName, "Goal status is not recognized.");
        var identity = IdempotencyRequest.Create(command.HouseholdId, actorUserId, IdempotencyOperation.ChangeGoalStatus,
            command.IdempotencyKey, command.GoalId, command.Status);
        return store.ChangeGoalStatusAsync(actorUserId, command, identity, cancellationToken);
    }

    public Task<IReadOnlyList<ProjectView>> ListProjectsAsync(
        Guid actorUserId, Guid householdId, CancellationToken cancellationToken) =>
        store.ListProjectsAsync(actorUserId, householdId, cancellationToken);

    public Task<ProjectView> GetProjectAsync(
        Guid actorUserId, Guid householdId, Guid projectId, CancellationToken cancellationToken) =>
        store.GetProjectAsync(actorUserId, householdId, projectId, cancellationToken);

    public Task<ProjectView> CreateProjectAsync(
        Guid actorUserId, CreateProjectCommand command, CancellationToken cancellationToken)
    {
        var project = FinancialProject.Create(command.Id, command.HouseholdId, command.Name, command.Currency,
            command.PlannedCents, command.StartsOn, command.EndsOn, command.Notes, command.Lines);
        var identity = IdempotencyRequest.Create(command.HouseholdId, actorUserId, IdempotencyOperation.CreateProject,
            command.IdempotencyKey, command.Id, project.Name, project.Currency, project.PlannedCents,
            project.StartsOn, project.EndsOn, project.Notes, LineFingerprint(project.Lines));
        return store.CreateProjectAsync(actorUserId, command with
        {
            Name = project.Name,
            Currency = project.Currency,
            Notes = project.Notes,
            Lines = project.Lines,
        }, identity, cancellationToken);
    }

    public Task<ProjectView> UpdateProjectAsync(
        Guid actorUserId, UpdateProjectCommand command, CancellationToken cancellationToken)
    {
        var identity = IdempotencyRequest.Create(command.HouseholdId, actorUserId, IdempotencyOperation.UpdateProject,
            command.IdempotencyKey, command.ProjectId, command.Name, command.PlannedCents,
            command.StartsOn, command.EndsOn, command.Notes, LineFingerprint(command.Lines));
        return store.UpdateProjectAsync(actorUserId, command, identity, cancellationToken);
    }

    public Task<ProjectView> CloseProjectAsync(
        Guid actorUserId, CloseProjectCommand command, CancellationToken cancellationToken)
    {
        var identity = IdempotencyRequest.Create(command.HouseholdId, actorUserId, IdempotencyOperation.CloseProject,
            command.IdempotencyKey, command.ProjectId);
        return store.CloseProjectAsync(actorUserId, command, identity, cancellationToken);
    }

    public Task<ProjectView> LinkMovementAsync(
        Guid actorUserId, LinkProjectMovementCommand command, CancellationToken cancellationToken) =>
        ChangeLink(actorUserId, command, IdempotencyOperation.LinkProjectMovement, cancellationToken);

    public Task<ProjectView> UnlinkMovementAsync(
        Guid actorUserId, LinkProjectMovementCommand command, CancellationToken cancellationToken) =>
        ChangeLink(actorUserId, command, IdempotencyOperation.UnlinkProjectMovement, cancellationToken);

    public Task<IReadOnlyList<AgendaItem>> AgendaAsync(
        Guid actorUserId, Guid householdId, DateOnly from, DateOnly to, DateOnly today, CancellationToken cancellationToken)
    {
        FinancialAgenda.Compose([], [], from, to, today);
        return store.AgendaAsync(actorUserId, householdId, from, to, today, cancellationToken);
    }

    public Task<IReadOnlyList<ForecastComparisonPoint>> CompareForecastAsync(
        Guid actorUserId, Guid householdId, Guid forecastId, CancellationToken cancellationToken) =>
        store.CompareForecastAsync(actorUserId, householdId, forecastId, cancellationToken);

    private Task<ProjectView> ChangeLink(
        Guid actorUserId, LinkProjectMovementCommand command, IdempotencyOperation operation, CancellationToken cancellationToken)
    {
        if (command.TransactionId == Guid.Empty)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidProject, "Choose a ledger transaction to associate.");
        var identity = IdempotencyRequest.Create(command.HouseholdId, actorUserId, operation,
            command.IdempotencyKey, command.ProjectId, command.TransactionId);
        return operation == IdempotencyOperation.LinkProjectMovement
            ? store.LinkMovementAsync(actorUserId, command, identity, cancellationToken)
            : store.UnlinkMovementAsync(actorUserId, command, identity, cancellationToken);
    }

    private static void EnsureRange(DateOnly from, DateOnly to)
    {
        if (to < from)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidPeriod, "Period start cannot be after period end.");
    }

    private static string LineFingerprint(IReadOnlyList<ProjectLine> lines) =>
        string.Join("|", lines.OrderBy(line => line.Id).Select(line => $"{line.Id}:{line.Name}:{line.Flow}:{line.AmountCents}"));
}
