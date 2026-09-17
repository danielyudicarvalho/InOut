using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Persistence;

public sealed partial class InOutDbContext
{
    internal DbSet<IdempotencyRequestRecord> IdempotencyRequests => Set<IdempotencyRequestRecord>();
    internal DbSet<OutboxMessageRecord> OutboxMessages => Set<OutboxMessageRecord>();
    internal DbSet<InboxMessageRecord> InboxMessages => Set<InboxMessageRecord>();

    private static void ConfigureReliability(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<IdempotencyRequestRecord>(entity =>
        {
            entity.ToTable("idempotency_requests", "private");
            entity.HasKey(item => new { item.TenantId, item.Operation, item.IdempotencyKey });
            entity.Property(item => item.TenantId).HasColumnName("tenant_id");
            entity.Property(item => item.Operation).HasColumnName("operation");
            entity.Property(item => item.IdempotencyKey).HasColumnName("idempotency_key");
            entity.Property(item => item.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(item => item.RequestFingerprint).HasColumnName("request_fingerprint");
            entity.Property(item => item.Status).HasColumnName("status");
            entity.Property(item => item.ResponseCode).HasColumnName("response_code");
            entity.Property(item => item.ResponseBody).HasColumnName("response_body").HasColumnType("jsonb");
            entity.Property(item => item.ResourceType).HasColumnName("resource_type");
            entity.Property(item => item.ResourceId).HasColumnName("resource_id");
            entity.Property(item => item.AttemptCount).HasColumnName("attempt_count");
            entity.Property(item => item.LockedUntil).HasColumnName("locked_until");
            entity.Property(item => item.CreatedAt).HasColumnName("created_at");
            entity.Property(item => item.UpdatedAt).HasColumnName("updated_at");
            entity.Property(item => item.CompletedAt).HasColumnName("completed_at");
            entity.Property(item => item.ExpiresAt).HasColumnName("expires_at");
            entity.Property(item => item.LastErrorCode).HasColumnName("last_error_code");
        });

        modelBuilder.Entity<OutboxMessageRecord>(entity =>
        {
            entity.ToTable("outbox_messages", "private");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.TenantId).HasColumnName("tenant_id");
            entity.Property(item => item.AggregateType).HasColumnName("aggregate_type");
            entity.Property(item => item.AggregateId).HasColumnName("aggregate_id");
            entity.Property(item => item.AggregateVersion).HasColumnName("aggregate_version");
            entity.Property(item => item.EventType).HasColumnName("event_type");
            entity.Property(item => item.Payload).HasColumnName("payload").HasColumnType("jsonb");
            entity.Property(item => item.OccurredAt).HasColumnName("occurred_at");
            entity.Property(item => item.PublishedAt).HasColumnName("published_at");
            entity.Property(item => item.AttemptCount).HasColumnName("attempt_count");
            entity.Property(item => item.LastError).HasColumnName("last_error");
        });

        modelBuilder.Entity<InboxMessageRecord>(entity =>
        {
            entity.ToTable("inbox_messages", "private");
            entity.HasKey(item => new { item.Consumer, item.MessageId });
            entity.Property(item => item.Consumer).HasColumnName("consumer");
            entity.Property(item => item.MessageId).HasColumnName("message_id");
            entity.Property(item => item.TenantId).HasColumnName("tenant_id");
            entity.Property(item => item.MessageFingerprint).HasColumnName("message_fingerprint");
            entity.Property(item => item.Status).HasColumnName("status");
            entity.Property(item => item.ReceivedAt).HasColumnName("received_at");
            entity.Property(item => item.ProcessedAt).HasColumnName("processed_at");
        });
    }
}

internal sealed class IdempotencyRequestRecord
{
    public Guid TenantId { get; set; }
    public string Operation { get; set; } = string.Empty;
    public Guid IdempotencyKey { get; set; }
    public Guid ActorUserId { get; set; }
    public string RequestFingerprint { get; set; } = string.Empty;
    public string Status { get; set; } = PersistenceVocabulary.IdempotencyStatuses.Processing;
    public int? ResponseCode { get; set; }
    public string? ResponseBody { get; set; }
    public string? ResourceType { get; set; }
    public Guid? ResourceId { get; set; }
    public int AttemptCount { get; set; }
    public DateTimeOffset LockedUntil { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public string? LastErrorCode { get; set; }
}

internal sealed class OutboxMessageRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string AggregateType { get; set; } = string.Empty;
    public Guid AggregateId { get; set; }
    public long AggregateVersion { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string Payload { get; set; } = PersistenceVocabulary.Json.EmptyObject;
    public DateTimeOffset OccurredAt { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public int AttemptCount { get; set; }
    public string? LastError { get; set; }
}

internal sealed class InboxMessageRecord
{
    public string Consumer { get; set; } = string.Empty;
    public Guid MessageId { get; set; }
    public Guid TenantId { get; set; }
    public string MessageFingerprint { get; set; } = string.Empty;
    public string Status { get; set; } = PersistenceVocabulary.InboxStatuses.Processing;
    public DateTimeOffset ReceivedAt { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
}
