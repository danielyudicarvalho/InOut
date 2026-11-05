using System.Net;
using System.Text.Json;
using InOut.Application.Financial;
using InOut.Application.Financial.Planning;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Idempotency;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed class EfPlanningStore(
    InOutDbContext dbContext, IIdempotencyPolicy policy, TimeProvider timeProvider) : IPlanningStore
{
    private readonly EfIdempotencyCoordinator idempotency = new(dbContext, timeProvider, policy);

    public async Task<IReadOnlyList<BudgetView>> ListBudgetsAsync(
        Guid actorUserId, Guid householdId, DateOnly from, DateOnly until, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserSnapshotAsync(actorUserId, cancellationToken);
        var budgets = await dbContext.Budgets.AsNoTracking()
            .Where(item => item.HouseholdId == householdId && item.PeriodStart <= until && item.PeriodEnd >= from)
            .ToListAsync(cancellationToken);
        var categories = await CategoryNames(householdId, cancellationToken);
        var postings = budgets.Count == 0
            ? ([], new Dictionary<Guid, string>(), new Dictionary<Guid, string>())
            : await LoadPostings(householdId, budgets.Min(item => item.PeriodStart), budgets.Max(item => item.PeriodEnd), cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return budgets.Select(budget => ToBudget(budget, categories, postings.Postings, postings.Currencies))
            .OrderBy(item => item.CategoryName).ThenBy(item => item.Currency).ToArray();
    }

    public async Task<BudgetDetail> GetBudgetAsync(
        Guid actorUserId, Guid householdId, Guid budgetId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserSnapshotAsync(actorUserId, cancellationToken);
        var budget = await dbContext.Budgets.AsNoTracking()
            .SingleOrDefaultAsync(item => item.HouseholdId == householdId && item.Id == budgetId, cancellationToken)
            ?? throw new FinancialRuleException(FinancialErrorCodes.BudgetNotFound, "Budget was not found.");
        var categories = await CategoryNames(householdId, cancellationToken);
        var names = await dbContext.Accounts.AsNoTracking()
            .Where(item => item.HouseholdId == householdId)
            .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        var postings = await LoadPostings(householdId, budget.PeriodStart, budget.PeriodEnd, cancellationToken);
        var revisions = await dbContext.BudgetRevisions.AsNoTracking()
            .Where(item => item.HouseholdId == householdId && item.BudgetId == budgetId)
            .OrderBy(item => item.CreatedAt).ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        var view = ToBudget(budget, categories, postings.Postings, postings.Currencies);
        var expenses = budget.Currency is null
            ? []
            : BudgetUsage.Expenses(postings.Postings, postings.Currencies, names, budget.CategoryId, budget.Currency);
        return new BudgetDetail(view, revisions.Select(item => new BudgetRevisionView(
            item.Id, item.PreviousLimitCents, item.LimitCents, item.Currency, item.CreatedBy, item.CreatedAt)).ToArray(), expenses);
    }

    public async Task<IReadOnlyList<GoalView>> ListGoalsAsync(
        Guid actorUserId, Guid householdId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserSnapshotAsync(actorUserId, cancellationToken);
        var goals = await dbContext.Goals.AsNoTracking()
            .Where(item => item.HouseholdId == householdId)
            .OrderBy(item => item.ArchivedAt == null ? 0 : 1).ThenBy(item => item.Name)
            .ToListAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return goals.Select(item => ToGoalView(item)).ToArray();
    }

    public async Task<GoalDetail> GetGoalAsync(
        Guid actorUserId, Guid householdId, Guid goalId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserSnapshotAsync(actorUserId, cancellationToken);
        var goal = await RequireGoal(householdId, goalId, tracking: false, cancellationToken);
        var allocations = await dbContext.GoalAllocations.AsNoTracking()
            .Where(item => item.HouseholdId == householdId && item.GoalId == goalId)
            .OrderBy(item => item.OccurredOn).ThenBy(item => item.CreatedAt).ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new GoalDetail(ToGoalView(goal), allocations.Select(ToAllocationItem).ToArray());
    }

    public Task<GoalView> CreateGoalAsync(
        Guid actorUserId, CreateGoalCommand command, IdempotencyRequest identity, CancellationToken cancellationToken) =>
        Write(identity, async () =>
        {
            if (await dbContext.Goals.AnyAsync(item => item.Id == command.Id, cancellationToken))
                throw new FinancialRuleException(FinancialErrorCodes.InvalidGoalName, "Goal identifier is already in use.");
            var now = timeProvider.GetUtcNow();
            var goal = Goal.Create(command.Id, command.HouseholdId, command.Name, command.TargetCents,
                command.TargetDate, actorUserId, command.Currency);
            dbContext.Goals.Add(new GoalRecord
            {
                Id = goal.Id,
                HouseholdId = goal.HouseholdId,
                Name = goal.Name,
                Currency = goal.Currency,
                TargetCents = goal.TargetCents,
                AllocatedCents = 0,
                TargetDate = goal.TargetDate,
                Status = goal.Status,
                CreatedBy = actorUserId,
                CreatedAt = now,
            });
            await Audit(command.HouseholdId, actorUserId, PersistenceVocabulary.AuditActions.GoalCreated,
                PersistenceVocabulary.EntityTypes.Goal, goal.Id, new { goal.Id, goal.Name, goal.Currency, goal.TargetCents }, cancellationToken);
            return ToGoalView(goal);
        }, cancellationToken);

    public Task<GoalView> UpdateGoalAsync(
        Guid actorUserId, UpdateGoalCommand command, IdempotencyRequest identity, CancellationToken cancellationToken) =>
        Write(identity, async () =>
        {
            var record = await RequireMutableGoal(command.HouseholdId, command.GoalId, cancellationToken);
            var updated = ToDomain(record).UpdateDetails(command.Name, command.TargetCents, command.TargetDate);
            record.Name = updated.Name;
            record.TargetCents = updated.TargetCents;
            record.TargetDate = updated.TargetDate;
            record.Status = updated.Status;
            await Audit(command.HouseholdId, actorUserId, PersistenceVocabulary.AuditActions.GoalUpdated,
                PersistenceVocabulary.EntityTypes.Goal, record.Id, new { record.Id, record.Name, record.TargetCents }, cancellationToken);
            return ToGoalView(updated);
        }, cancellationToken);

    public Task<GoalView> ChangeGoalStatusAsync(
        Guid actorUserId, ChangeGoalStatusCommand command, IdempotencyRequest identity, CancellationToken cancellationToken) =>
        Write(identity, async () =>
        {
            var record = await RequireMutableGoal(command.HouseholdId, command.GoalId, cancellationToken);
            var goal = ToDomain(record);
            var changed = command.Status switch
            {
                "paused" => goal.Pause(),
                "active" => goal.Resume(),
                "completed" => goal.Complete(),
                "archived" => goal.Archive(timeProvider.GetUtcNow()),
                _ => throw new FinancialRuleException(FinancialErrorCodes.InvalidGoalName, "Goal status is not recognized."),
            };
            record.Status = changed.Status;
            record.ArchivedAt = changed.ArchivedAt;
            await Audit(command.HouseholdId, actorUserId, PersistenceVocabulary.AuditActions.GoalUpdated,
                PersistenceVocabulary.EntityTypes.Goal, record.Id, new { record.Id, Status = command.Status }, cancellationToken);
            return ToGoalView(changed);
        }, cancellationToken);

    public async Task<IReadOnlyList<ProjectView>> ListProjectsAsync(
        Guid actorUserId, Guid householdId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserSnapshotAsync(actorUserId, cancellationToken);
        var projects = await dbContext.FinancialProjects.AsNoTracking().Include(item => item.Lines)
            .Where(item => item.HouseholdId == householdId)
            .OrderBy(item => item.Status).ThenBy(item => item.Name)
            .ToListAsync(cancellationToken);
        var views = new List<ProjectView>(projects.Count);
        foreach (var project in projects)
            views.Add(await ToProjectView(project, cancellationToken));
        await transaction.CommitAsync(cancellationToken);
        return views;
    }

    public async Task<ProjectView> GetProjectAsync(
        Guid actorUserId, Guid householdId, Guid projectId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserSnapshotAsync(actorUserId, cancellationToken);
        var project = await RequireProject(householdId, projectId, tracking: false, cancellationToken);
        var view = await ToProjectView(project, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return view;
    }

    public Task<ProjectView> CreateProjectAsync(
        Guid actorUserId, CreateProjectCommand command, IdempotencyRequest identity, CancellationToken cancellationToken) =>
        Write(identity, async () =>
        {
            var project = FinancialProject.Create(command.Id, command.HouseholdId, command.Name, command.Currency,
                command.PlannedCents, command.StartsOn, command.EndsOn, command.Notes, command.Lines);
            var now = timeProvider.GetUtcNow();
            var record = new FinancialProjectRecord
            {
                Id = project.Id,
                HouseholdId = project.HouseholdId,
                Name = project.Name,
                Currency = project.Currency,
                PlannedCents = project.PlannedCents,
                StartsOn = project.StartsOn,
                EndsOn = project.EndsOn,
                Notes = project.Notes,
                Status = project.Status,
                CreatedBy = actorUserId,
                CreatedAt = now,
                Lines = project.Lines.Select(line => new ProjectLineRecord
                {
                    Id = line.Id,
                    HouseholdId = project.HouseholdId,
                    ProjectId = project.Id,
                    Name = line.Name,
                    Flow = line.Flow,
                    AmountCents = line.AmountCents,
                }).ToList(),
            };
            dbContext.FinancialProjects.Add(record);
            await Audit(command.HouseholdId, actorUserId, PersistenceVocabulary.AuditActions.ProjectCreated,
                PersistenceVocabulary.EntityTypes.FinancialProject, project.Id, new { project.Id, project.Name }, cancellationToken);
            return ToProjectView(project, [], new ProjectComparison(
                project.Lines.Where(line => line.Flow == FinancialFlow.Income).Sum(line => line.AmountCents),
                project.Lines.Count == 0
                    ? project.PlannedCents
                    : project.Lines.Where(line => line.Flow == FinancialFlow.Expense).Sum(line => line.AmountCents),
                0, 0));
        }, cancellationToken);

    public Task<ProjectView> UpdateProjectAsync(
        Guid actorUserId, UpdateProjectCommand command, IdempotencyRequest identity, CancellationToken cancellationToken) =>
        Write(identity, async () =>
        {
            var record = await RequireProject(command.HouseholdId, command.ProjectId, tracking: true, cancellationToken);
            var updated = ToProject(record).Update(command.Name, command.PlannedCents, command.StartsOn,
                command.EndsOn, command.Notes, command.Lines);
            record.Name = updated.Name;
            record.PlannedCents = updated.PlannedCents;
            record.StartsOn = updated.StartsOn;
            record.EndsOn = updated.EndsOn;
            record.Notes = updated.Notes;
            dbContext.ProjectLines.RemoveRange(record.Lines);
            record.Lines.Clear();
            foreach (var line in updated.Lines)
            {
                record.Lines.Add(new ProjectLineRecord
                {
                    Id = line.Id,
                    HouseholdId = record.HouseholdId,
                    ProjectId = record.Id,
                    Name = line.Name,
                    Flow = line.Flow,
                    AmountCents = line.AmountCents,
                });
            }
            await Audit(command.HouseholdId, actorUserId, PersistenceVocabulary.AuditActions.ProjectUpdated,
                PersistenceVocabulary.EntityTypes.FinancialProject, record.Id, new { record.Id, record.Name }, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return await ToProjectView(record, cancellationToken);
        }, cancellationToken);

    public Task<ProjectView> CloseProjectAsync(
        Guid actorUserId, CloseProjectCommand command, IdempotencyRequest identity, CancellationToken cancellationToken) =>
        Write(identity, async () =>
        {
            var record = await RequireProject(command.HouseholdId, command.ProjectId, tracking: true, cancellationToken);
            var closed = ToProject(record).Close();
            record.Status = closed.Status;
            record.ClosedAt = timeProvider.GetUtcNow();
            await Audit(command.HouseholdId, actorUserId, PersistenceVocabulary.AuditActions.ProjectClosed,
                PersistenceVocabulary.EntityTypes.FinancialProject, record.Id, new { record.Id }, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return await ToProjectView(record, cancellationToken);
        }, cancellationToken);

    public Task<ProjectView> LinkMovementAsync(
        Guid actorUserId, LinkProjectMovementCommand command, IdempotencyRequest identity, CancellationToken cancellationToken) =>
        Write(identity, async () =>
        {
            var record = await RequireProject(command.HouseholdId, command.ProjectId, tracking: true, cancellationToken);
            ToProject(record).EnsureOpen();
            await RequireLinkableTransaction(command.HouseholdId, command.TransactionId, record.Currency, cancellationToken);
            var exists = await dbContext.ProjectMovements.AnyAsync(item =>
                item.HouseholdId == command.HouseholdId && item.ProjectId == command.ProjectId &&
                item.TransactionId == command.TransactionId, cancellationToken);
            if (!exists)
            {
                dbContext.ProjectMovements.Add(new ProjectMovementRecord
                {
                    HouseholdId = command.HouseholdId,
                    ProjectId = command.ProjectId,
                    TransactionId = command.TransactionId,
                    LinkedBy = actorUserId,
                    LinkedAt = timeProvider.GetUtcNow(),
                });
            }
            await Audit(command.HouseholdId, actorUserId, PersistenceVocabulary.AuditActions.ProjectMovementLinked,
                PersistenceVocabulary.EntityTypes.FinancialProject, record.Id, new { record.Id, command.TransactionId }, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return await ToProjectView(record, cancellationToken);
        }, cancellationToken);

    public Task<ProjectView> UnlinkMovementAsync(
        Guid actorUserId, LinkProjectMovementCommand command, IdempotencyRequest identity, CancellationToken cancellationToken) =>
        Write(identity, async () =>
        {
            var record = await RequireProject(command.HouseholdId, command.ProjectId, tracking: true, cancellationToken);
            ToProject(record).EnsureOpen();
            var link = await dbContext.ProjectMovements.SingleOrDefaultAsync(item =>
                item.HouseholdId == command.HouseholdId && item.ProjectId == command.ProjectId &&
                item.TransactionId == command.TransactionId, cancellationToken);
            if (link is not null)
                dbContext.ProjectMovements.Remove(link);
            await Audit(command.HouseholdId, actorUserId, PersistenceVocabulary.AuditActions.ProjectMovementUnlinked,
                PersistenceVocabulary.EntityTypes.FinancialProject, record.Id, new { record.Id, command.TransactionId }, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return await ToProjectView(record, cancellationToken);
        }, cancellationToken);

    public async Task<IReadOnlyList<AgendaItem>> AgendaAsync(
        Guid actorUserId, Guid householdId, DateOnly from, DateOnly until, DateOnly today, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserSnapshotAsync(actorUserId, cancellationToken);
        var plans = await dbContext.RecurringPlans.AsNoTracking()
            .Where(item => item.HouseholdId == householdId).ToListAsync(cancellationToken);
        var occurrences = await dbContext.RecurringOccurrences.AsNoTracking()
            .Where(item => item.HouseholdId == householdId && item.ScheduledOn >= from && item.ScheduledOn <= until)
            .ToListAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return FinancialAgenda.Compose(
            plans.Select(item => new RecurringPlan(
                item.Id, item.HouseholdId, item.Name, item.Flow, item.AccountId, item.CategoryId,
                item.IncomeSourceId, Money.Positive(item.AmountCents, item.Currency), item.DayOfMonth,
                item.StartsOn, item.EndsOn, item.Status)),
            occurrences.Select(item => new AgendaOccurrence(
                item.Id, item.PlanId, item.ScheduledOn, item.TransactionId, item.Flow, item.AmountCents, item.Currency)),
            from, until, today);
    }

    public async Task<IReadOnlyList<ForecastComparisonPoint>> CompareForecastAsync(
        Guid actorUserId, Guid householdId, Guid forecastId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserSnapshotAsync(actorUserId, cancellationToken);
        var forecast = await dbContext.Forecasts.AsNoTracking()
            .SingleOrDefaultAsync(item => item.HouseholdId == householdId && item.Id == forecastId, cancellationToken)
            ?? throw new FinancialRuleException(FinancialErrorCodes.ForecastNotFound, "Forecast was not found.");
        var stored = JsonSerializer.Deserialize<StoredForecastMonth[]>(forecast.Points) ?? [];
        var points = stored.Select(item => new ForecastPoint(
            item.Month, item.ExpectedIncomeCents, item.ExpectedExpenseCents, item.ProjectedBalanceCents, [], [])).ToArray();
        if (points.Length == 0)
        {
            await transaction.CommitAsync(cancellationToken);
            return [];
        }
        var start = points.Min(item => item.Month);
        var end = points.Max(item => item.Month).AddMonths(1).AddDays(-1);
        var postings = await LoadPostings(householdId, start, end, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        var actuals = points.Select(point => ForecastComparison.Actual(point.Month, forecast.AccountId, postings.Postings)).ToArray();
        return ForecastComparison.Compare(points, actuals);
    }

    private async Task<T> Write<T>(IdempotencyRequest identity, Func<Task<T>> change, CancellationToken cancellationToken)
        where T : class
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(identity.ActorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<T>(identity, cancellationToken);
        if (acquisition.IsReplay)
        {
            await transaction.CommitAsync(cancellationToken);
            return Replay(acquisition.Response!);
        }
        var result = await change();
        var resourceId = result switch
        {
            GoalView goal => goal.Id,
            ProjectView project => project.Id,
            _ => identity.Key,
        };
        idempotency.Complete(acquisition.Record, result, (int)HttpStatusCode.OK,
            result is GoalView ? PersistenceVocabulary.EntityTypes.Goal : PersistenceVocabulary.EntityTypes.FinancialProject,
            resourceId);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    private static T Replay<T>(T result) => result switch
    {
        GoalView goal => (T)(object)(goal with { Replayed = true }),
        ProjectView project => (T)(object)(project with { Replayed = true }),
        _ => result,
    };

    private async Task Audit(
        Guid householdId, Guid actorUserId, string action, string entityType, Guid entityId, object payload,
        CancellationToken cancellationToken)
    {
        dbContext.AuditEvents.Add(new AuditEventRecord
        {
            HouseholdId = householdId,
            ActorUserId = actorUserId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
        });
        var version = (await dbContext.OutboxMessages
            .Where(item => item.AggregateType == entityType && item.AggregateId == entityId)
            .Select(item => (long?)item.AggregateVersion)
            .MaxAsync(cancellationToken) ?? 0) + 1;
        idempotency.AddOutboxEvent(householdId, entityType, entityId, version, action, payload);
    }

    private async Task<GoalRecord> RequireGoal(Guid householdId, Guid goalId, bool tracking, CancellationToken cancellationToken)
    {
        var query = tracking ? dbContext.Goals : dbContext.Goals.AsNoTracking();
        return await query.SingleOrDefaultAsync(item => item.HouseholdId == householdId && item.Id == goalId, cancellationToken)
            ?? throw new FinancialRuleException(FinancialErrorCodes.GoalNotFound, "Goal was not found.");
    }

    private async Task<GoalRecord> RequireMutableGoal(Guid householdId, Guid goalId, CancellationToken cancellationToken)
    {
        var record = await RequireGoal(householdId, goalId, tracking: true, cancellationToken);
        if (string.IsNullOrWhiteSpace(record.Currency))
            throw new FinancialRuleException(FinancialErrorCodes.InvalidCurrency,
                "Goal currency must be explicit before the goal can change.");
        return record;
    }

    private async Task<FinancialProjectRecord> RequireProject(
        Guid householdId, Guid projectId, bool tracking, CancellationToken cancellationToken)
    {
        var query = tracking
            ? dbContext.FinancialProjects.Include(item => item.Lines)
            : dbContext.FinancialProjects.AsNoTracking().Include(item => item.Lines);
        return await query.SingleOrDefaultAsync(item => item.HouseholdId == householdId && item.Id == projectId, cancellationToken)
            ?? throw new FinancialRuleException(FinancialErrorCodes.ProjectNotFound, "Project was not found.");
    }

    private async Task RequireLinkableTransaction(
        Guid householdId, Guid transactionId, string currency, CancellationToken cancellationToken)
    {
        var transaction = await dbContext.FinancialTransactions.AsNoTracking().Include(item => item.Entries)
            .SingleOrDefaultAsync(item => item.HouseholdId == householdId && item.Id == transactionId, cancellationToken)
            ?? throw new FinancialRuleException(FinancialErrorCodes.TransactionNotFound, "Transaction was not found.");
        if (transaction.Status is not (FinancialTransactionStatus.Posted or FinancialTransactionStatus.Reversed))
            throw new FinancialRuleException(FinancialErrorCodes.InvalidProject, "Only a posted transaction can be associated.");
        var accountIds = transaction.Entries.Select(item => item.AccountId).Distinct().ToArray();
        var matches = await dbContext.Accounts.AsNoTracking().AnyAsync(item =>
            item.HouseholdId == householdId && accountIds.Contains(item.Id) && item.Currency == currency, cancellationToken);
        if (!matches)
            throw new FinancialRuleException(FinancialErrorCodes.CurrencyMismatch,
                "Associate a transaction in the project currency.");
    }

    private async Task<ProjectView> ToProjectView(FinancialProjectRecord record, CancellationToken cancellationToken)
    {
        var links = await dbContext.ProjectMovements.AsNoTracking()
            .Where(item => item.HouseholdId == record.HouseholdId && item.ProjectId == record.Id)
            .Select(item => item.TransactionId)
            .ToArrayAsync(cancellationToken);
        var transactions = links.Length == 0
            ? []
            : await dbContext.FinancialTransactions.AsNoTracking().Include(item => item.Entries)
                .Where(item => item.HouseholdId == record.HouseholdId && links.Contains(item.Id))
                .ToListAsync(cancellationToken);
        var currencies = await dbContext.Accounts.AsNoTracking()
            .Where(item => item.HouseholdId == record.HouseholdId)
            .ToDictionaryAsync(item => item.Id, item => item.Currency, cancellationToken);
        var project = ToProject(record);
        var postings = transactions.SelectMany(item => ToPostings(item, transactions)).ToArray();
        var movements = transactions.Select(item => new ProjectMovementView(item.Id, item.OccurredOn, item.Description))
            .OrderBy(item => item.OccurredOn).ToArray();
        return ToProjectView(project, movements, ProjectComparison.From(project, postings, currencies));
    }

    private async Task<Dictionary<Guid, string>> CategoryNames(Guid householdId, CancellationToken cancellationToken) =>
        await dbContext.Categories.AsNoTracking()
            .Where(item => item.HouseholdId == householdId)
            .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);

    private async Task<(DashboardPosting[] Postings, Dictionary<Guid, string> Currencies, Dictionary<Guid, string> Names)> LoadPostings(
        Guid householdId, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var transactions = await dbContext.FinancialTransactions.AsNoTracking().Include(item => item.Entries)
            .Where(item => item.HouseholdId == householdId && item.OccurredOn >= from && item.OccurredOn <= to)
            .ToListAsync(cancellationToken);
        var missing = transactions.Where(item => item.ReversalOf is not null).Select(item => item.ReversalOf!.Value)
            .Except(transactions.Select(item => item.Id)).Distinct().ToArray();
        if (missing.Length > 0)
        {
            transactions.AddRange(await dbContext.FinancialTransactions.AsNoTracking()
                .Where(item => item.HouseholdId == householdId && missing.Contains(item.Id))
                .ToListAsync(cancellationToken));
        }
        var accounts = await dbContext.Accounts.AsNoTracking()
            .Where(item => item.HouseholdId == householdId)
            .ToDictionaryAsync(item => item.Id, item => item, cancellationToken);
        var postings = transactions.Where(item => item.Entries.Count > 0)
            .SelectMany(item => ToPostings(item, transactions)).ToArray();
        return (postings,
            accounts.ToDictionary(item => item.Key, item => item.Value.Currency),
            accounts.ToDictionary(item => item.Key, item => item.Value.Name));
    }

    private static IEnumerable<DashboardPosting> ToPostings(
        FinancialTransactionRecord transaction, IReadOnlyList<FinancialTransactionRecord> known)
    {
        FinancialTransactionKind? reversed = null;
        if (transaction.ReversalOf is { } original && known.FirstOrDefault(item => item.Id == original) is { } found)
            reversed = found.Kind;
        return transaction.Entries.Select(entry => new DashboardPosting(
            entry.AccountId, entry.CategoryId, transaction.Kind, reversed, entry.AmountCents,
            transaction.IncomeSourceId, transaction.Id, entry.Id, transaction.OccurredOn,
            transaction.Description, transaction.ReversalOf, entry.Direction));
    }

    private static BudgetView ToBudget(
        BudgetRecord budget, Dictionary<Guid, string> categories,
        IReadOnlyList<DashboardPosting> postings, IReadOnlyDictionary<Guid, string> currencies)
    {
        long? spent = budget.Currency is null
            ? null
            : BudgetUsage.Spent(postings, currencies, budget.CategoryId, budget.Currency);
        return new BudgetView(
            budget.Id, budget.CategoryId,
            categories.TryGetValue(budget.CategoryId, out var name) ? name : "Categoria",
            budget.PeriodStart, budget.PeriodEnd, budget.LimitCents,
            spent, spent is { } amount ? BudgetUsage.Remaining(budget.LimitCents, amount) : null,
            budget.Currency);
    }

    private static Goal ToDomain(GoalRecord record) => Goal.Restore(
        record.Id, record.HouseholdId, record.Name, record.TargetCents, record.AllocatedCents,
        record.TargetDate, record.CreatedBy, record.CreatedAt, record.ArchivedAt, record.Currency!, record.Status);

    private static GoalView ToGoalView(GoalRecord record) => new(
        record.Id, record.Name, record.TargetCents, record.AllocatedCents, record.TargetDate,
        record.Currency, record.Status, record.ArchivedAt);

    private static GoalView ToGoalView(Goal goal) => new(
        goal.Id, goal.Name, goal.TargetCents, goal.AllocatedCents, goal.TargetDate,
        goal.Currency, goal.Status, goal.ArchivedAt);

    private static GoalAllocationItem ToAllocationItem(GoalAllocationRecord record) => new(
        record.Id, record.AmountCents, record.Currency, record.Kind, record.Origin, record.ReversalOf,
        record.OccurredOn, record.Note, record.CreatedBy, record.CreatedAt);

    private static FinancialProject ToProject(FinancialProjectRecord record) => new(
        record.Id, record.HouseholdId, record.Name, record.Currency, record.PlannedCents,
        record.StartsOn, record.EndsOn, record.Notes, record.Status,
        record.Lines.OrderBy(item => item.Name).Select(item => new ProjectLine(item.Id, item.Name, item.Flow, item.AmountCents)).ToArray());

    private static ProjectView ToProjectView(
        FinancialProject project, IReadOnlyList<ProjectMovementView> movements, ProjectComparison comparison) => new(
        project.Id, project.Name, project.Currency, project.PlannedCents, project.StartsOn, project.EndsOn,
        project.Notes, project.Status, project.Lines, movements, comparison);

    private sealed class StoredForecastMonth
    {
        public DateOnly Month { get; set; }
        public long ExpectedIncomeCents { get; set; }
        public long ExpectedExpenseCents { get; set; }
        public long ProjectedBalanceCents { get; set; }
    }
}
