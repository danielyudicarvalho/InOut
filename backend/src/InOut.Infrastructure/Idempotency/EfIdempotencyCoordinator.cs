using System.Diagnostics.Metrics;
using System.Text.Json;
using InOut.Application.Idempotency;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Idempotency;

internal sealed class EfIdempotencyCoordinator(
    InOutDbContext dbContext,
    TimeProvider timeProvider,
    IIdempotencyPolicy policyProvider)
{
    private static readonly Meter Meter = new(
        PersistenceVocabulary.Metrics.MeterName,
        PersistenceVocabulary.Metrics.MeterVersion);
    private static readonly Counter<long> Started =
        Meter.CreateCounter<long>(PersistenceVocabulary.Metrics.Started);
    private static readonly Counter<long> Replayed =
        Meter.CreateCounter<long>(PersistenceVocabulary.Metrics.Replayed);
    private static readonly Counter<long> Conflicts =
        Meter.CreateCounter<long>(PersistenceVocabulary.Metrics.Conflicts);
    private static readonly Counter<long> InProgress =
        Meter.CreateCounter<long>(PersistenceVocabulary.Metrics.InProgress);
    private static readonly Counter<long> Reclaimed =
        Meter.CreateCounter<long>(PersistenceVocabulary.Metrics.Reclaimed);
    private static readonly Counter<long> Failed =
        Meter.CreateCounter<long>(PersistenceVocabulary.Metrics.Failed);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    internal async Task<IdempotencyAcquisition<TResult>> AcquireAsync<TResult>(
        IdempotencyRequest request,
        CancellationToken cancellationToken)
    {
        var operation = OperationName(request.Operation);
        var policy = policyProvider.GetPolicy(request.Operation);
        var now = timeProvider.GetUtcNow();
        var processingStatus = PersistenceVocabulary.IdempotencyStatuses.Processing;
        var inserted = await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            insert into private.idempotency_requests (
                tenant_id, operation, idempotency_key, actor_user_id,
                request_fingerprint, status, attempt_count, locked_until,
                created_at, updated_at, expires_at)
            values (
                {request.TenantId}, {operation}, {request.Key}, {request.ActorUserId},
                {request.RequestFingerprint}, {processingStatus}, 1, {now + policy.LeaseDuration},
                {now}, {now}, {now + policy.Retention})
            on conflict (tenant_id, operation, idempotency_key) do nothing
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            select 1
            from private.idempotency_requests
            where tenant_id = {request.TenantId}
              and operation = {operation}
              and idempotency_key = {request.Key}
            for update
            """, cancellationToken);

        var record = await dbContext.IdempotencyRequests.SingleAsync(
            item => item.TenantId == request.TenantId &&
                item.Operation == operation &&
                item.IdempotencyKey == request.Key,
            cancellationToken);

        if (inserted == 1)
        {
            Started.Add(1, Tags(operation));
            return IdempotencyAcquisition<TResult>.Acquired(record);
        }

        if (record.ActorUserId != request.ActorUserId ||
            record.RequestFingerprint != request.RequestFingerprint)
        {
            Conflicts.Add(1, Tags(operation));
            throw new IdempotencyException(
                IdempotencyErrorCodes.Conflict,
                "Idempotency key was already used by another actor or with a different request.");
        }

        if (record.Status == PersistenceVocabulary.IdempotencyStatuses.Completed)
        {
            Replayed.Add(1, Tags(operation));
            var response = JsonSerializer.Deserialize<TResult>(record.ResponseBody!, JsonOptions)
                ?? throw new InvalidOperationException("Stored idempotency response is invalid.");
            return IdempotencyAcquisition<TResult>.Replay(record, response);
        }

        if (record.Status == PersistenceVocabulary.IdempotencyStatuses.FailedFinal)
        {
            Replayed.Add(1, Tags(operation));
            throw new IdempotencyException(
                record.LastErrorCode ?? IdempotencyErrorCodes.Failed,
                "The original operation reached a final failure state.");
        }

        if (record.LockedUntil > now)
        {
            InProgress.Add(1, Tags(operation));
            throw new IdempotencyException(
                IdempotencyErrorCodes.InProgress,
                "The original operation is still processing. Retry later with the same key.");
        }

        record.Status = PersistenceVocabulary.IdempotencyStatuses.Processing;
        record.AttemptCount += 1;
        record.LockedUntil = now + policy.LeaseDuration;
        record.UpdatedAt = now;
        record.LastErrorCode = null;
        Reclaimed.Add(1, Tags(operation));
        return IdempotencyAcquisition<TResult>.Acquired(record);
    }

    internal void Complete<TResult>(
        IdempotencyRequestRecord record,
        TResult response,
        int responseCode,
        string resourceType,
        Guid resourceId)
    {
        var now = timeProvider.GetUtcNow();
        record.Status = PersistenceVocabulary.IdempotencyStatuses.Completed;
        record.ResponseCode = responseCode;
        record.ResponseBody = JsonSerializer.Serialize(response, JsonOptions);
        record.ResourceType = resourceType;
        record.ResourceId = resourceId;
        record.CompletedAt = now;
        record.UpdatedAt = now;
        record.LockedUntil = now;
    }

    internal void AddOutboxEvent(
        Guid tenantId,
        string aggregateType,
        Guid aggregateId,
        long aggregateVersion,
        string eventType,
        object payload) =>
        dbContext.OutboxMessages.Add(new OutboxMessageRecord
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            AggregateType = aggregateType,
            AggregateId = aggregateId,
            AggregateVersion = aggregateVersion,
            EventType = eventType,
            Payload = JsonSerializer.Serialize(payload, JsonOptions),
            OccurredAt = timeProvider.GetUtcNow(),
        });

    internal void MarkFailure(
        IdempotencyRequestRecord record,
        string errorCode,
        bool retryable)
    {
        var now = timeProvider.GetUtcNow();
        record.Status = retryable
            ? PersistenceVocabulary.IdempotencyStatuses.FailedRetryable
            : PersistenceVocabulary.IdempotencyStatuses.FailedFinal;
        record.LastErrorCode = errorCode;
        record.UpdatedAt = now;
        record.LockedUntil = retryable ? now : record.ExpiresAt;
        Failed.Add(1, Tags(record.Operation));
    }

    private static string OperationName(IdempotencyOperation operation) => operation switch
    {
        IdempotencyOperation.CreateAccount => PersistenceVocabulary.OperationNames.CreateAccount,
        IdempotencyOperation.PostIncome => PersistenceVocabulary.OperationNames.PostIncome,
        IdempotencyOperation.PostExpense => PersistenceVocabulary.OperationNames.PostExpense,
        IdempotencyOperation.PostTransfer => PersistenceVocabulary.OperationNames.PostTransfer,
        IdempotencyOperation.ReverseTransaction => PersistenceVocabulary.OperationNames.ReverseTransaction,
        _ => throw new ArgumentOutOfRangeException(nameof(operation), operation, null),
    };

    private static KeyValuePair<string, object?> Tags(string operation) =>
        new(PersistenceVocabulary.MetricTags.Operation, operation);
}

internal sealed record IdempotencyAcquisition<TResult>(
    IdempotencyRequestRecord Record,
    bool IsReplay,
    TResult? Response)
{
    internal static IdempotencyAcquisition<TResult> Acquired(IdempotencyRequestRecord record) =>
        new(record, false, default);

    internal static IdempotencyAcquisition<TResult> Replay(
        IdempotencyRequestRecord record,
        TResult response) =>
        new(record, true, response);
}
