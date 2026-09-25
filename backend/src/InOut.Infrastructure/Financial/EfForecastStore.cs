using System.Net;
using System.Text.Json;
using InOut.Application.Financial.Forecasts;
using InOut.Application.Idempotency;
using InOut.Domain.Financial;
using InOut.Infrastructure.Idempotency;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Financial;

public sealed class EfForecastStore(
    InOutDbContext dbContext, IIdempotencyPolicy policy, TimeProvider timeProvider)
    : IForecastStore
{
    private readonly EfIdempotencyCoordinator idempotency = new(dbContext, timeProvider, policy);

    public async Task<ForecastSummary> CreateAsync(Guid householdId, Guid accountId,
        DateOnly asOf, int months, IdempotencyRequest identity,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserSnapshotAsync(
            identity.ActorUserId, cancellationToken);
        var acquisition = await idempotency.AcquireAsync<ForecastSummary>(identity, cancellationToken);
        if (acquisition.IsReplay)
        {
            await transaction.CommitAsync(cancellationToken);
            return acquisition.Response! with { Replayed = true };
        }

        var account = await dbContext.Accounts.AsNoTracking().SingleOrDefaultAsync(
            item => item.HouseholdId == householdId && item.Id == accountId && item.ArchivedAt == null,
            cancellationToken);
        if (account is null)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidForecast,
                "Forecast account must be active and belong to this household.");

        var opening = await dbContext.Entries.AsNoTracking()
            .Where(item => item.HouseholdId == householdId && item.AccountId == accountId)
            .SumAsync(item => (long?)(item.Direction == EntryDirection.Credit
                ? item.AmountCents : -item.AmountCents), cancellationToken) ?? 0;
        var rows = await dbContext.RecurringPlans.AsNoTracking()
            .Where(item => item.HouseholdId == householdId && item.AccountId == accountId &&
                item.Status == RecurringPlanStatus.Active && item.StartsOn <= asOf.AddMonths(months) &&
                (item.EndsOn == null || item.EndsOn >= asOf))
            .ToArrayAsync(cancellationToken);
        var plans = rows.Select(row => RecurringPlan.Create(row.Id, row.HouseholdId,
            row.Name, row.Flow, row.AccountId, row.CategoryId, row.IncomeSourceId,
            row.AmountCents, row.Currency, row.DayOfMonth, row.StartsOn, row.EndsOn)
            .ChangeStatus(row.Status)).ToArray();
        var points = Forecast.Project(asOf, months, opening, plans);
        var result = new ForecastSummary(Guid.NewGuid(), householdId, accountId,
            account.Currency, asOf, months, opening, points, timeProvider.GetUtcNow());
        dbContext.Forecasts.Add(new ForecastRecord
        {
            Id = result.Id,
            HouseholdId = householdId,
            AccountId = accountId,
            Currency = account.Currency,
            AsOf = asOf,
            Months = months,
            OpeningBalanceCents = opening,
            Points = JsonSerializer.Serialize(points),
            CalculatedAt = result.CalculatedAt,
            CreatedBy = identity.ActorUserId,
        });
        idempotency.Complete(acquisition.Record, result, (int)HttpStatusCode.Created,
            "forecast", result.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task<ForecastSummary> GetAsync(Guid householdId, Guid id,
        Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var row = await dbContext.Forecasts.AsNoTracking().SingleOrDefaultAsync(
            item => item.HouseholdId == householdId && item.Id == id, cancellationToken);
        if (row is null)
            throw new FinancialRuleException(FinancialErrorCodes.ForecastNotFound,
                "Forecast was not found.");
        await transaction.CommitAsync(cancellationToken);
        return ToSummary(row);
    }

    public async Task<IReadOnlyList<ForecastSummary>> ListAsync(Guid householdId,
        Guid actorUserId, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.BeginUserTransactionAsync(actorUserId, cancellationToken);
        var rows = await dbContext.Forecasts.AsNoTracking()
            .Where(item => item.HouseholdId == householdId)
            .OrderByDescending(item => item.CalculatedAt)
            .Take(50).ToArrayAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return rows.Select(ToSummary).ToArray();
    }

    private static ForecastSummary ToSummary(ForecastRecord row) => new(
        row.Id, row.HouseholdId, row.AccountId, row.Currency, row.AsOf,
        row.Months, row.OpeningBalanceCents,
        JsonSerializer.Deserialize<ForecastPoint[]>(row.Points) ?? [], row.CalculatedAt);
}
