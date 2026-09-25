using InOut.Application.Idempotency;
using InOut.Domain.Financial;

namespace InOut.Application.Financial.RecurringPlans;

public sealed record CreateRecurringPlanCommand(
    Guid Id, Guid HouseholdId, string Name, FinancialFlow Flow,
    Guid AccountId, Guid CategoryId, Guid? IncomeSourceId,
    long AmountCents, string Currency, int DayOfMonth,
    DateOnly StartsOn, DateOnly? EndsOn, Guid IdempotencyKey);

public sealed record RecurringPlanSummary(
    Guid Id, Guid HouseholdId, string Name, FinancialFlow Flow,
    Guid AccountId, Guid CategoryId, Guid? IncomeSourceId,
    long AmountCents, string Currency, int DayOfMonth,
    DateOnly StartsOn, DateOnly? EndsOn, RecurringPlanStatus Status,
    bool Replayed = false);

public interface IRecurringPlanStore
{
    Task<RecurringPlanSummary> CreateAsync(RecurringPlan plan, IdempotencyRequest identity,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<RecurringPlanSummary>> ListAsync(Guid householdId, Guid actorUserId,
        CancellationToken cancellationToken);
    Task<RecurringPlanSummary> GetAsync(Guid householdId, Guid id, Guid actorUserId,
        CancellationToken cancellationToken);
    Task<RecurringPlanSummary> ChangeStatusAsync(Guid householdId, Guid id,
        RecurringPlanStatus status, Guid actorUserId, CancellationToken cancellationToken);
}

public sealed class RecurringPlanService(IRecurringPlanStore store)
{
    public Task<RecurringPlanSummary> CreateAsync(Guid actorUserId,
        CreateRecurringPlanCommand command, CancellationToken cancellationToken)
    {
        var plan = RecurringPlan.Create(command.Id, command.HouseholdId, command.Name,
            command.Flow, command.AccountId, command.CategoryId, command.IncomeSourceId,
            command.AmountCents, command.Currency, command.DayOfMonth,
            command.StartsOn, command.EndsOn);
        var identity = IdempotencyRequest.Create(plan.HouseholdId, actorUserId,
            IdempotencyOperation.CreateRecurringPlan, command.IdempotencyKey,
            plan.Id, plan.Name, plan.Flow, plan.AccountId, plan.CategoryId,
            plan.IncomeSourceId, plan.Amount.Cents, plan.Amount.Currency,
            plan.DayOfMonth, plan.StartsOn, plan.EndsOn);
        return store.CreateAsync(plan, identity, cancellationToken);
    }

    public Task<IReadOnlyList<RecurringPlanSummary>> ListAsync(
        Guid householdId, Guid actorUserId, CancellationToken cancellationToken) =>
        store.ListAsync(householdId, actorUserId, cancellationToken);

    public Task<RecurringPlanSummary> GetAsync(
        Guid householdId, Guid id, Guid actorUserId, CancellationToken cancellationToken) =>
        store.GetAsync(householdId, id, actorUserId, cancellationToken);

    public Task<RecurringPlanSummary> ChangeStatusAsync(
        Guid householdId, Guid id, RecurringPlanStatus status,
        Guid actorUserId, CancellationToken cancellationToken) =>
        store.ChangeStatusAsync(householdId, id, status, actorUserId, cancellationToken);

    public static IReadOnlyList<DateOnly> Preview(RecurringPlanSummary summary,
        DateOnly from, int count) =>
        RecurringPlan.Create(summary.Id, summary.HouseholdId, summary.Name,
            summary.Flow, summary.AccountId, summary.CategoryId, summary.IncomeSourceId,
            summary.AmountCents, summary.Currency, summary.DayOfMonth,
            summary.StartsOn, summary.EndsOn)
            .ChangeStatus(summary.Status)
            .NextDates(from, count);
}
