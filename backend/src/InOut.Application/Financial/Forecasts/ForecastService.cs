using InOut.Application.Idempotency;
using InOut.Domain.Financial;

namespace InOut.Application.Financial.Forecasts;

public sealed record ForecastSummary(
    Guid Id, Guid HouseholdId, Guid AccountId, string Currency,
    DateOnly AsOf, int Months, long OpeningBalanceCents,
    IReadOnlyList<ForecastPoint> Points, DateTimeOffset CalculatedAt,
    bool Replayed = false);

public interface IForecastStore
{
    Task<ForecastSummary> CreateAsync(Guid householdId, Guid accountId,
        DateOnly asOf, int months, IdempotencyRequest identity,
        CancellationToken cancellationToken);
    Task<ForecastSummary> GetAsync(Guid householdId, Guid id, Guid actorUserId,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<ForecastSummary>> ListAsync(Guid householdId, Guid actorUserId,
        CancellationToken cancellationToken);
}

public sealed class ForecastService(IForecastStore store, TimeProvider timeProvider)
{
    public Task<ForecastSummary> CreateAsync(Guid householdId, Guid accountId,
        DateOnly asOf, int months, Guid actorUserId, Guid idempotencyKey,
        CancellationToken cancellationToken)
    {
        if (householdId == Guid.Empty || accountId == Guid.Empty || months is < 1 or > 12 ||
            asOf < DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime) || asOf.Year > 9998)
            throw new FinancialRuleException(FinancialErrorCodes.InvalidForecast,
                "Choose an account, a date from today onward, and one to twelve months.");
        var identity = IdempotencyRequest.Create(householdId, actorUserId,
            IdempotencyOperation.CreateForecast, idempotencyKey, accountId, asOf, months);
        return store.CreateAsync(householdId, accountId, asOf, months, identity, cancellationToken);
    }

    public Task<ForecastSummary> GetAsync(Guid householdId, Guid id, Guid actorUserId,
        CancellationToken cancellationToken) => store.GetAsync(householdId, id, actorUserId, cancellationToken);

    public Task<IReadOnlyList<ForecastSummary>> ListAsync(Guid householdId, Guid actorUserId,
        CancellationToken cancellationToken) => store.ListAsync(householdId, actorUserId, cancellationToken);
}
