using System.Net;
using InOut.Application.Financial;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed partial class EfLedgerStore
{
    public async Task<BudgetResult> SetBudgetAsync(
        Guid actorUserId,
        SetBudgetCommand command,
        IdempotencyRequest idempotencyRequest,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<BudgetResult>(idempotencyRequest, cancellationToken);
        if (acquisition.IsReplay)
        {
            await databaseTransaction.CommitAsync(cancellationToken);
            return acquisition.Response! with { Replayed = true };
        }

        var category = await dbContext.Categories
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.HouseholdId == command.HouseholdId && item.Id == command.CategoryId,
                cancellationToken);

        if (category is null || category.ArchivedAt is not null || category.Flow != FinancialFlow.Expense)
        {
            throw new FinancialRuleException(
                FinancialErrorCodes.InvalidCategory,
                "Budget limit requires an active expense category in this household.");
        }

        var currency = new Money(0, command.Currency).Currency;
        var existing = command.Id is { } id
            ? await dbContext.Budgets.SingleOrDefaultAsync(item => item.HouseholdId == command.HouseholdId && item.Id == id, cancellationToken)
            : await dbContext.Budgets.SingleOrDefaultAsync(item => item.HouseholdId == command.HouseholdId &&
                item.CategoryId == command.CategoryId && item.PeriodStart == command.PeriodStart &&
                item.PeriodEnd == command.PeriodEnd && item.Currency == currency, cancellationToken);
        if (existing is not null && (existing.CategoryId != command.CategoryId || existing.PeriodStart != command.PeriodStart ||
            existing.PeriodEnd != command.PeriodEnd || (existing.Currency is not null && existing.Currency != currency)))
            throw new FinancialRuleException(FinancialErrorCodes.CurrencyMismatch, "An existing budget's category, period and assigned currency cannot change.");

        Guid budgetId = command.Id ?? Guid.NewGuid();
        Budget budget;
        long? previousLimit = existing?.LimitCents;
        var previousCurrency = existing?.Currency;
        if (existing is not null)
        {
            budgetId = existing.Id;
            var domainBudget = new Budget(
                existing.Id,
                existing.HouseholdId,
                existing.CategoryId,
                existing.PeriodStart,
                existing.PeriodEnd,
                existing.LimitCents,
                currency).UpdateLimit(command.LimitCents);

            existing.LimitCents = domainBudget.LimitCents;
            existing.Currency = domainBudget.Currency;
            budget = domainBudget;
        }
        else
        {
            budget = Budget.Create(
                budgetId,
                command.HouseholdId,
                command.CategoryId,
                command.PeriodStart,
                command.PeriodEnd,
                command.LimitCents,
                currency);

            var record = new BudgetRecord
            {
                Id = budget.Id,
                HouseholdId = budget.HouseholdId,
                CategoryId = budget.CategoryId,
                PeriodStart = budget.PeriodStart,
                PeriodEnd = budget.PeriodEnd,
                LimitCents = budget.LimitCents,
                Currency = budget.Currency,
                CreatedBy = actorUserId,
            };
            dbContext.Budgets.Add(record);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (existing is null || previousLimit != budget.LimitCents || previousCurrency != budget.Currency)
        {
            dbContext.BudgetRevisions.Add(new BudgetRevisionRecord
            {
                Id = Guid.NewGuid(),
                HouseholdId = command.HouseholdId,
                BudgetId = budgetId,
                PreviousLimitCents = existing is null ? null : previousLimit,
                LimitCents = budget.LimitCents,
                Currency = budget.Currency,
                CreatedBy = actorUserId,
                CreatedAt = timeProvider.GetUtcNow(),
            });
        }

        AddAudit(
            command.HouseholdId,
            actorUserId,
            PersistenceVocabulary.AuditActions.BudgetSet,
            PersistenceVocabulary.EntityTypes.Budget,
            budgetId);

        var maxVersion = await dbContext.OutboxMessages
            .Where(item => item.AggregateType == PersistenceVocabulary.EntityTypes.Budget && item.AggregateId == budgetId)
            .Select(item => (long?)item.AggregateVersion)
            .MaxAsync(cancellationToken) ?? 0;

        idempotency.AddOutboxEvent(
            command.HouseholdId,
            PersistenceVocabulary.EntityTypes.Budget,
            budgetId,
            maxVersion + 1,
            PersistenceVocabulary.AuditActions.BudgetSet,
            new { BudgetId = budgetId, command.CategoryId, command.PeriodStart, command.PeriodEnd, command.LimitCents, Currency = currency });

        var result = new BudgetResult(
            budgetId,
            command.HouseholdId,
            command.CategoryId,
            command.PeriodStart,
            command.PeriodEnd,
            command.LimitCents,
            false,
            currency);

        idempotency.Complete(
            acquisition.Record,
            result,
            (int)HttpStatusCode.OK,
            PersistenceVocabulary.EntityTypes.Budget,
            budgetId);

        await dbContext.SaveChangesAsync(cancellationToken);
        await databaseTransaction.CommitAsync(cancellationToken);

        return result;
    }
}
