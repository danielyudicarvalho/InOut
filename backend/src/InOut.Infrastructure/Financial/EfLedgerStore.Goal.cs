using System.Net;
using InOut.Application.Financial;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace InOut.Infrastructure.Financial;

public sealed partial class EfLedgerStore
{
    public async Task<GoalAllocationResult> AllocateToGoalAsync(
        Guid actorUserId,
        AllocateGoalCommand command,
        IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<GoalAllocationResult>(idempotencyRequest, cancellationToken);
        if (acquisition.IsReplay)
        {
            await databaseTransaction.CommitAsync(cancellationToken);
            return acquisition.Response! with { Replayed = true };
        }

        var change = await AppendAllocationAsync(
            command.HouseholdId,
            command.GoalId,
            actorUserId,
            PersistenceVocabulary.AuditActions.GoalAllocationRecorded,
            (goal, history, createdAt) => goal.Allocate(
                history,
                Guid.NewGuid(),
                command.AmountCents,
                command.Currency,
                command.OccurredOn,
                actorUserId,
                command.Note,
                createdAt),
            cancellationToken);
        return await FinishAllocationAsync(acquisition.Record, change, databaseTransaction, cancellationToken);
    }

    public async Task<GoalAllocationResult> ReverseGoalAllocationAsync(
        Guid actorUserId,
        ReverseGoalAllocationCommand command,
        IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<GoalAllocationResult>(idempotencyRequest, cancellationToken);
        if (acquisition.IsReplay)
        {
            await databaseTransaction.CommitAsync(cancellationToken);
            return acquisition.Response! with { Replayed = true };
        }

        var change = await AppendAllocationAsync(
            command.HouseholdId,
            command.GoalId,
            actorUserId,
            PersistenceVocabulary.AuditActions.GoalAllocationReversed,
            (goal, history, createdAt) => goal.ReverseAllocation(
                history,
                Guid.NewGuid(),
                command.AllocationId,
                command.OccurredOn,
                actorUserId,
                command.Note,
                createdAt),
            cancellationToken);
        return await FinishAllocationAsync(acquisition.Record, change, databaseTransaction, cancellationToken);
    }

    public async Task<GoalAllocationHistory> ListGoalAllocationsAsync(
        Guid actorUserId,
        Guid householdId,
        Guid goalId,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var goal = await dbContext.Goals.AsNoTracking()
            .SingleOrDefaultAsync(item => item.HouseholdId == householdId && item.Id == goalId, cancellationToken);
        if (goal is null)
        {
            throw new FinancialRuleException(FinancialErrorCodes.GoalNotFound, "Goal was not found.");
        }

        var records = await dbContext.GoalAllocations.AsNoTracking()
            .Where(item => item.HouseholdId == householdId && item.GoalId == goalId)
            .OrderBy(item => item.OccurredOn)
            .ThenBy(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        var net = records.Aggregate(0L, (sum, item) => checked(sum + (item.Kind == GoalAllocationKind.Reversal
            ? -item.AmountCents
            : item.AmountCents)));
        return new GoalAllocationHistory(
            goal.Id,
            goal.Currency,
            goal.TargetCents,
            goal.AllocatedCents,
            goal.Status,
            net == goal.AllocatedCents && (goal.Currency is not null || goal.AllocatedCents == 0),
            records.Select(ToItem).ToArray());
    }

    private async Task<GoalProgress> AppendAllocationAsync(
        Guid householdId,
        Guid goalId,
        Guid actorUserId,
        string auditAction,
        Func<Goal, IReadOnlyList<GoalAllocation>, DateTimeOffset, GoalProgress> change,
        CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select id from public.goals where household_id = {householdId} and id = {goalId} for update",
            cancellationToken);
        var goalRecord = await dbContext.Goals.SingleOrDefaultAsync(
            item => item.HouseholdId == householdId && item.Id == goalId,
            cancellationToken);
        if (goalRecord is null)
        {
            throw new FinancialRuleException(FinancialErrorCodes.GoalNotFound, "Goal was not found.");
        }

        if (string.IsNullOrWhiteSpace(goalRecord.Currency))
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidCurrency,
                "Goal currency must be explicit before its progress can change.");
        }

        var records = await dbContext.GoalAllocations
            .Where(item => item.HouseholdId == householdId && item.GoalId == goalId)
            .ToListAsync(cancellationToken);
        var progress = change(ToGoal(goalRecord), records.Select(ToAllocation).ToArray(), timeProvider.GetUtcNow());
        dbContext.GoalAllocations.Add(ToRecord(progress.Allocation));
        await dbContext.SaveChangesAsync(cancellationToken);

        goalRecord.AllocatedCents = progress.Goal.AllocatedCents;
        goalRecord.Status = progress.Goal.Status;
        AddAudit(householdId, actorUserId, auditAction, PersistenceVocabulary.EntityTypes.GoalAllocation, progress.Allocation.Id);
        var maxVersion = await dbContext.OutboxMessages
            .Where(item => item.AggregateType == PersistenceVocabulary.EntityTypes.GoalAllocation
                && item.AggregateId == goalId)
            .Select(item => (long?)item.AggregateVersion)
            .MaxAsync(cancellationToken) ?? 0;
        idempotency.AddOutboxEvent(
            householdId,
            PersistenceVocabulary.EntityTypes.GoalAllocation,
            goalId,
            maxVersion + 1,
            auditAction,
            new
            {
                progress.Allocation.Id,
                GoalId = goalId,
                progress.Allocation.AmountCents,
                progress.Allocation.Currency,
                progress.Allocation.Kind,
                progress.Allocation.ReversalOf,
                progress.Goal.AllocatedCents,
            });
        return progress;
    }

    private async Task<GoalAllocationResult> FinishAllocationAsync(
        IdempotencyRequestRecord record,
        GoalProgress progress,
        IDbContextTransaction databaseTransaction,
        CancellationToken cancellationToken)
    {
        var result = ToResult(progress);
        idempotency.Complete(
            record,
            result,
            (int)HttpStatusCode.Created,
            PersistenceVocabulary.EntityTypes.GoalAllocation,
            progress.Allocation.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);
        return result;
    }

    private static Goal ToGoal(GoalRecord record) =>
        Goal.Restore(
            record.Id,
            record.HouseholdId,
            record.Name,
            record.TargetCents,
            record.AllocatedCents,
            record.TargetDate,
            record.CreatedBy,
            record.CreatedAt,
            record.ArchivedAt,
            record.Currency!,
            record.Status);

    private static GoalAllocation ToAllocation(GoalAllocationRecord record) =>
        GoalAllocation.Restore(
            record.Id,
            record.HouseholdId,
            record.GoalId,
            record.AmountCents,
            record.Currency,
            record.Kind,
            record.Origin,
            record.ReversalOf,
            record.OccurredOn,
            record.Note,
            record.CreatedBy,
            record.CreatedAt);

    private static GoalAllocationRecord ToRecord(GoalAllocation allocation) =>
        new()
        {
            Id = allocation.Id,
            HouseholdId = allocation.HouseholdId,
            GoalId = allocation.GoalId,
            AmountCents = allocation.AmountCents,
            Currency = allocation.Currency,
            Kind = allocation.Kind,
            Origin = allocation.Origin,
            ReversalOf = allocation.ReversalOf,
            OccurredOn = allocation.OccurredOn,
            Note = allocation.Note,
            CreatedBy = allocation.CreatedBy,
            CreatedAt = allocation.CreatedAt,
        };

    private static GoalAllocationItem ToItem(GoalAllocationRecord record) =>
        new(
            record.Id,
            record.AmountCents,
            record.Currency,
            record.Kind,
            record.Origin,
            record.ReversalOf,
            record.OccurredOn,
            record.Note,
            record.CreatedBy,
            record.CreatedAt);

    private static GoalAllocationResult ToResult(GoalProgress progress) =>
        new(
            progress.Allocation.Id,
            progress.Allocation.HouseholdId,
            progress.Allocation.GoalId,
            progress.Allocation.AmountCents,
            progress.Allocation.Currency,
            progress.Allocation.Kind,
            progress.Allocation.Origin,
            progress.Allocation.ReversalOf,
            progress.Allocation.OccurredOn,
            progress.Allocation.Note,
            progress.Allocation.CreatedBy,
            progress.Allocation.CreatedAt,
            progress.Goal.AllocatedCents,
            progress.Goal.Status);
}
