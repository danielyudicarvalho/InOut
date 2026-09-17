namespace InOut.Application.Idempotency;

public sealed record InboxMessage(
    string Consumer,
    Guid MessageId,
    Guid TenantId,
    Guid ActorUserId,
    string MessageFingerprint);

public interface IInboxMessageProcessor
{
    Task<bool> ExecuteOnceAsync(
        InboxMessage message,
        Func<CancellationToken, Task> handler,
        CancellationToken cancellationToken);
}
