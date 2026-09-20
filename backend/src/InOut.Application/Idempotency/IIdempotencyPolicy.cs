namespace InOut.Application.Idempotency;

public sealed record IdempotencyExecutionPolicy(
    TimeSpan LeaseDuration,
    TimeSpan Retention);

public interface IIdempotencyPolicy
{
    IdempotencyExecutionPolicy GetPolicy(IdempotencyOperation operation);
}
