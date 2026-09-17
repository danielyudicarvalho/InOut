using InOut.Application.Idempotency;
using InOut.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace InOut.Infrastructure.Idempotency;

public sealed class EfInboxMessageProcessor(
    InOutDbContext dbContext,
    TimeProvider timeProvider) : IInboxMessageProcessor
{
    public async Task<bool> ExecuteOnceAsync(
        InboxMessage message,
        Func<CancellationToken, Task> handler,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"select set_config('request.jwt.claim.sub', {message.ActorUserId.ToString()}, true)",
            cancellationToken);
        var now = timeProvider.GetUtcNow();
        var inserted = await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            insert into private.inbox_messages (
                consumer, message_id, tenant_id, message_fingerprint,
                status, received_at)
            values (
                {message.Consumer}, {message.MessageId}, {message.TenantId},
                {message.MessageFingerprint}, 'processing', {now})
            on conflict (consumer, message_id) do nothing
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            select 1
            from private.inbox_messages
            where consumer = {message.Consumer} and message_id = {message.MessageId}
            for update
            """, cancellationToken);
        var record = await dbContext.InboxMessages.SingleAsync(
            item => item.Consumer == message.Consumer && item.MessageId == message.MessageId,
            cancellationToken);

        if (record.TenantId != message.TenantId ||
            record.MessageFingerprint != message.MessageFingerprint)
        {
            throw new IdempotencyException(
                "message_identity_conflict",
                "Message identifier was reused with different content or tenant.");
        }

        if (inserted == 0 && record.Status == "processed")
        {
            await transaction.CommitAsync(cancellationToken);
            return false;
        }

        await handler(cancellationToken);
        record.Status = "processed";
        record.ProcessedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }
}
