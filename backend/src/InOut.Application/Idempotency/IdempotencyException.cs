namespace InOut.Application.Idempotency;

public sealed class IdempotencyException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
