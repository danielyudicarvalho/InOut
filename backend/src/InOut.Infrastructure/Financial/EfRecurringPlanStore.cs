using System.Net;
using InOut.Application.Financial.RecurringPlans;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Idempotency;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace InOut.Infrastructure.Financial;

public sealed class EfRecurringPlanStore(
    InOutDbContext dbContext, IIdempotencyPolicy policy, TimeProvider timeProvider)
    : IRecurringPlanStore
{
    private readonly EfIdempotencyCoordinator idempotency = new(dbContext, timeProvider, policy);

    public async Task<RecurringPlanSummary> CreateAsync(
        RecurringPlan plan, IdempotencyRequest identity, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(
            identity.ActorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<RecurringPlanSummary>(identity, cancellationToken);
        if (acquisition.IsReplay)
        {
            await transaction.CommitAsync(cancellationToken);
            return acquisition.Response! with { Replayed = true };
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select id from public.accounts where household_id={plan.HouseholdId} and id={plan.AccountId} for update",
            cancellationToken);
        var account = await dbContext.Accounts.AsNoTracking().SingleOrDefaultAsync(
            item => item.HouseholdId == plan.HouseholdId && item.Id == plan.AccountId,
            cancellationToken);
        var category = await dbContext.Categories.AsNoTracking().SingleOrDefaultAsync(
            item => item.HouseholdId == plan.HouseholdId && item.Id == plan.CategoryId,
            cancellationToken);
        IncomeSourceRecord? source = null;
        if (plan.IncomeSourceId is { } sourceId)
            source = await dbContext.IncomeSources.AsNoTracking().SingleOrDefaultAsync(
                item => item.HouseholdId == plan.HouseholdId && item.Id == sourceId,
                cancellationToken);
        plan.ValidateReferences(
            account is null ? null : new Account(account.Id, account.HouseholdId,
                account.Name, account.Kind, account.Currency, account.ArchivedAt),
            category is null ? null : new Category(category.Id, category.HouseholdId,
                category.Name, category.Flow, category.ParentId, category.ArchivedAt),
            source is null ? null : new IncomeSource(source.Id, source.HouseholdId,
                source.Name, source.ArchivedAt));

        dbContext.RecurringPlans.Add(ToRecord(plan, identity.ActorUserId));
        dbContext.AuditEvents.Add(new AuditEventRecord
        {
            HouseholdId = plan.HouseholdId,
            ActorUserId = identity.ActorUserId,
            Action = "financial.recurring_plan.created",
            EntityType = "recurring_plan",
            EntityId = plan.Id,
        });
        var result = ToSummary(plan);
        idempotency.AddOutboxEvent(plan.HouseholdId, "recurring_plan", plan.Id, 1,
            "financial.recurring_plan.created", new { plan.Id, plan.HouseholdId });
        idempotency.Complete(acquisition.Record, result, (int)HttpStatusCode.Created,
            "recurring_plan", plan.Id);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException error) when (error.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new FinancialRuleException(FinancialErrorCodes.RecurringPlanConflict,
                "Recurring plan identifier already exists.");
        }
        return result;
    }

    public async Task<IReadOnlyList<RecurringPlanSummary>> ListAsync(
        Guid householdId, Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var rows = await dbContext.RecurringPlans.AsNoTracking()
            .Where(plan => plan.HouseholdId == householdId)
            .OrderBy(plan => plan.Name).ToArrayAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return rows.Select(ToSummary).ToArray();
    }

    public async Task<RecurringPlanSummary> GetAsync(
        Guid householdId, Guid id, Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var row = await dbContext.RecurringPlans.AsNoTracking().SingleOrDefaultAsync(
            item => item.HouseholdId == householdId && item.Id == id, cancellationToken);
        if (row is null) throw NotFound();
        await transaction.CommitAsync(cancellationToken);
        return ToSummary(row);
    }

    public async Task<RecurringPlanSummary> ChangeStatusAsync(
        Guid householdId, Guid id, RecurringPlanStatus status,
        Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var row = await dbContext.RecurringPlans.SingleOrDefaultAsync(
            item => item.HouseholdId == householdId && item.Id == id, cancellationToken);
        if (row is null) throw NotFound();
        var next = ToDomain(row).ChangeStatus(status);
        if (next.Status != row.Status)
        {
            row.Status = next.Status;
            row.UpdatedAt = timeProvider.GetUtcNow();
            dbContext.AuditEvents.Add(new AuditEventRecord
            {
                HouseholdId = householdId,
                ActorUserId = actorUserId,
                Action = "financial.recurring_plan.status_changed",
                EntityType = "recurring_plan",
                EntityId = id,
            });
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return ToSummary(next);
    }

    public async Task<RecurringOccurrenceResult> RealizeAsync(
        Guid actorUserId, RealizeRecurringOccurrenceCommand command,
        IdempotencyRequest identity, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<RecurringOccurrenceResult>(identity, cancellationToken);
        if (acquisition.IsReplay)
        {
            await transaction.CommitAsync(cancellationToken);
            return acquisition.Response! with { Replayed = true };
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select id from public.recurring_plans where household_id = {command.HouseholdId} and id = {command.PlanId} for update",
            cancellationToken);
        var row = await dbContext.RecurringPlans.AsNoTracking().SingleOrDefaultAsync(
            item => item.HouseholdId == command.HouseholdId && item.Id == command.PlanId, cancellationToken);
        if (row is null) throw NotFound();

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select id from public.accounts where household_id = {row.HouseholdId} and id = {row.AccountId} for update",
            cancellationToken);
        var plan = ToDomain(row);
        var account = await dbContext.Accounts.AsNoTracking().SingleOrDefaultAsync(
            item => item.HouseholdId == plan.HouseholdId && item.Id == plan.AccountId, cancellationToken);
        var category = await dbContext.Categories.AsNoTracking().SingleOrDefaultAsync(
            item => item.HouseholdId == plan.HouseholdId && item.Id == plan.CategoryId, cancellationToken);
        IncomeSourceRecord? source = null;
        if (plan.IncomeSourceId is { } sourceId)
            source = await dbContext.IncomeSources.AsNoTracking().SingleOrDefaultAsync(
                item => item.HouseholdId == plan.HouseholdId && item.Id == sourceId, cancellationToken);
        plan.ValidateReferences(
            account is null ? null : new Account(account.Id, account.HouseholdId,
                account.Name, account.Kind, account.Currency, account.ArchivedAt),
            category is null ? null : new Category(category.Id, category.HouseholdId,
                category.Name, category.Flow, category.ParentId, category.ArchivedAt),
            source is null ? null : new IncomeSource(source.Id, source.HouseholdId,
                source.Name, source.ArchivedAt));

        var history = await dbContext.RecurringOccurrences.AsNoTracking()
            .Where(item => item.HouseholdId == plan.HouseholdId && item.PlanId == plan.Id)
            .ToListAsync(cancellationToken);
        var realizedAt = timeProvider.GetUtcNow();
        var realization = plan.Realize(
            command.ScheduledOn, Guid.NewGuid(), actorUserId, realizedAt, history.Select(ToOccurrence).ToArray());
        AddTransaction(realization.Transaction, realizedAt);
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.RecurringOccurrences.Add(ToRecord(realization.Occurrence));
        dbContext.AuditEvents.Add(new AuditEventRecord
        {
            HouseholdId = plan.HouseholdId,
            ActorUserId = actorUserId,
            Action = PersistenceVocabulary.AuditActions.TransactionPosted,
            EntityType = PersistenceVocabulary.EntityTypes.Transaction,
            EntityId = realization.Transaction.Id,
        });
        dbContext.AuditEvents.Add(new AuditEventRecord
        {
            HouseholdId = plan.HouseholdId,
            ActorUserId = actorUserId,
            Action = PersistenceVocabulary.AuditActions.RecurringOccurrenceRealized,
            EntityType = PersistenceVocabulary.EntityTypes.RecurringOccurrence,
            EntityId = realization.Occurrence.Id,
        });
        idempotency.AddOutboxEvent(
            plan.HouseholdId, PersistenceVocabulary.EntityTypes.Transaction, realization.Transaction.Id, 1,
            PersistenceVocabulary.AuditActions.TransactionPosted,
            new { realization.Transaction.Id, plan.HouseholdId, realization.Transaction.Kind, realization.Transaction.OccurredOn });
        idempotency.AddOutboxEvent(
            plan.HouseholdId, PersistenceVocabulary.EntityTypes.RecurringOccurrence, realization.Occurrence.Id, 1,
            PersistenceVocabulary.AuditActions.RecurringOccurrenceRealized,
            new
            {
                realization.Occurrence.Id,
                PlanId = plan.Id,
                realization.Occurrence.ScheduledOn,
                realization.Occurrence.TransactionId,
            });
        var result = ToResult(realization.Occurrence);
        idempotency.Complete(acquisition.Record, result, (int)HttpStatusCode.Created,
            PersistenceVocabulary.EntityTypes.RecurringOccurrence, realization.Occurrence.Id);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException error)
        {
            if (!TryMapOccurrenceWrite(error, out var mapped))
                throw;
            throw mapped;
        }
        return result;
    }

    public async Task<IReadOnlyList<RecurringOccurrenceItem>> ListOccurrencesAsync(
        Guid householdId, Guid planId, Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var planExists = await dbContext.RecurringPlans.AsNoTracking().AnyAsync(
            item => item.HouseholdId == householdId && item.Id == planId, cancellationToken);
        if (!planExists) throw NotFound();
        var rows = await dbContext.RecurringOccurrences.AsNoTracking()
            .Where(item => item.HouseholdId == householdId && item.PlanId == planId)
            .OrderBy(item => item.ScheduledOn)
            .ThenBy(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return rows.Select(ToItem).ToArray();
    }

    private static bool TryMapOccurrenceWrite(DbUpdateException error, out FinancialRuleException mapped)
    {
        mapped = null!;
        if (error.InnerException is not PostgresException postgres)
            return false;
        if (postgres.SqlState == PostgresErrorCodes.UniqueViolation &&
            postgres.ConstraintName is "recurring_occurrences_plan_date_uidx" or "recurring_occurrences_transaction_uidx")
        {
            mapped = new FinancialRuleException(
                FinancialErrorCodes.RecurringOccurrenceAlreadyRealized,
                "This predicted date was already realized.");
            return true;
        }

        if (postgres.SqlState == PostgresErrorCodes.CheckViolation &&
            postgres.MessageText is "recurring_occurrence_not_scheduled" or
                "recurring_occurrence_plan_not_executable" or
                "recurring_occurrence_transaction_mismatch" or
                "recurring_occurrence_immutable")
        {
            mapped = new FinancialRuleException(
                FinancialErrorCodes.InvalidRecurringPlan,
                "The occurrence does not match an executable date of this plan.");
            return true;
        }

        return false;
    }

    private void AddTransaction(FinancialTransaction transaction, DateTimeOffset postedAt)
    {
        dbContext.FinancialTransactions.Add(new FinancialTransactionRecord
        {
            Id = transaction.Id,
            HouseholdId = transaction.HouseholdId,
            Kind = transaction.Kind,
            Status = FinancialTransactionStatus.Posted,
            Description = transaction.Description,
            OccurredOn = transaction.OccurredOn,
            ReversalOf = transaction.ReversalOf,
            IncomeSourceId = transaction.IncomeSourceId,
            CreatedBy = transaction.CreatedBy,
            CreatedAt = postedAt,
            PostedAt = postedAt,
            Entries = transaction.Entries.Select(entry => new EntryRecord
            {
                Id = entry.Id,
                HouseholdId = transaction.HouseholdId,
                TransactionId = transaction.Id,
                AccountId = entry.AccountId,
                CategoryId = entry.CategoryId,
                Direction = entry.Direction,
                AmountCents = entry.Amount.Cents,
                CreatedBy = transaction.CreatedBy,
                CreatedAt = postedAt,
            }).ToList(),
        });
    }

    private static FinancialRuleException NotFound() =>
        new(FinancialErrorCodes.RecurringPlanNotFound, "Recurring plan was not found.");

    private static RecurringPlanRecord ToRecord(RecurringPlan plan, Guid actorUserId) => new()
    {
        Id = plan.Id,
        HouseholdId = plan.HouseholdId,
        Name = plan.Name,
        Flow = plan.Flow,
        AccountId = plan.AccountId,
        CategoryId = plan.CategoryId,
        IncomeSourceId = plan.IncomeSourceId,
        AmountCents = plan.Amount.Cents,
        Currency = plan.Amount.Currency,
        DayOfMonth = plan.DayOfMonth,
        StartsOn = plan.StartsOn,
        EndsOn = plan.EndsOn,
        Status = plan.Status,
        CreatedBy = actorUserId,
    };

    private static RecurringPlan ToDomain(RecurringPlanRecord row) =>
        RecurringPlan.Create(row.Id, row.HouseholdId, row.Name, row.Flow,
            row.AccountId, row.CategoryId, row.IncomeSourceId,
            row.AmountCents, row.Currency, row.DayOfMonth, row.StartsOn, row.EndsOn)
            .ChangeStatus(row.Status);

    private static RecurringPlanSummary ToSummary(RecurringPlanRecord row) => ToSummary(ToDomain(row));

    private static RecurringPlanSummary ToSummary(RecurringPlan plan) => new(
        plan.Id, plan.HouseholdId, plan.Name, plan.Flow, plan.AccountId,
        plan.CategoryId, plan.IncomeSourceId, plan.Amount.Cents, plan.Amount.Currency,
        plan.DayOfMonth, plan.StartsOn, plan.EndsOn, plan.Status);

    private static RecurringOccurrenceRecord ToRecord(RecurringOccurrence occurrence) => new()
    {
        Id = occurrence.Id,
        HouseholdId = occurrence.HouseholdId,
        PlanId = occurrence.PlanId,
        ScheduledOn = occurrence.ScheduledOn,
        TransactionId = occurrence.TransactionId,
        Flow = occurrence.Flow,
        AmountCents = occurrence.AmountCents,
        Currency = occurrence.Currency,
        CreatedBy = occurrence.RealizedBy,
        CreatedAt = occurrence.RealizedAt,
    };

    private static RecurringOccurrence ToOccurrence(RecurringOccurrenceRecord row) =>
        RecurringOccurrence.Restore(
            row.Id, row.HouseholdId, row.PlanId, row.ScheduledOn, row.TransactionId,
            row.Flow, row.AmountCents, row.Currency, row.CreatedBy, row.CreatedAt);

    private static RecurringOccurrenceResult ToResult(RecurringOccurrence occurrence) => new(
        occurrence.Id, occurrence.PlanId, occurrence.HouseholdId, occurrence.ScheduledOn,
        occurrence.TransactionId, occurrence.Flow, occurrence.AmountCents, occurrence.Currency,
        occurrence.RealizedBy, occurrence.RealizedAt);

    private static RecurringOccurrenceItem ToItem(RecurringOccurrenceRecord row) => new(
        row.Id, row.PlanId, row.HouseholdId, row.ScheduledOn, row.TransactionId,
        row.Flow, row.AmountCents, row.Currency, row.CreatedBy, row.CreatedAt);
}
