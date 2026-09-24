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
            HouseholdId = plan.HouseholdId, ActorUserId = identity.ActorUserId,
            Action = "financial.recurring_plan.created", EntityType = "recurring_plan",
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
                HouseholdId = householdId, ActorUserId = actorUserId,
                Action = "financial.recurring_plan.status_changed",
                EntityType = "recurring_plan", EntityId = id,
            });
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return ToSummary(next);
    }

    private static FinancialRuleException NotFound() =>
        new(FinancialErrorCodes.RecurringPlanNotFound, "Recurring plan was not found.");

    private static RecurringPlanRecord ToRecord(RecurringPlan plan, Guid actorUserId) => new()
    {
        Id = plan.Id, HouseholdId = plan.HouseholdId, Name = plan.Name,
        Flow = plan.Flow, AccountId = plan.AccountId, CategoryId = plan.CategoryId,
        IncomeSourceId = plan.IncomeSourceId, AmountCents = plan.Amount.Cents,
        Currency = plan.Amount.Currency, DayOfMonth = plan.DayOfMonth,
        StartsOn = plan.StartsOn, EndsOn = plan.EndsOn,
        Status = plan.Status, CreatedBy = actorUserId,
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
}
