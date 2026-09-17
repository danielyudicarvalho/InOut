using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace InOut.Application.Idempotency;

public sealed record IdempotencyRequest(
    Guid TenantId,
    Guid ActorUserId,
    IdempotencyOperation Operation,
    Guid Key,
    string RequestFingerprint)
{
    public static IdempotencyRequest Create(
        Guid tenantId,
        Guid actorUserId,
        IdempotencyOperation operation,
        Guid key,
        params object?[] semanticValues)
    {
        if (tenantId == Guid.Empty || actorUserId == Guid.Empty)
        {
            throw new IdempotencyException(
                "invalid_idempotency_scope",
                "Tenant and actor identifiers are required.");
        }

        if (key == Guid.Empty)
        {
            throw new IdempotencyException(
                "invalid_idempotency_key",
                "Idempotency key is required.");
        }

        var canonical = new StringBuilder();
        Append(canonical, operation.ToString());
        foreach (var value in semanticValues)
        {
            Append(canonical, Canonicalize(value));
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(canonical.ToString()));
        return new IdempotencyRequest(
            tenantId,
            actorUserId,
            operation,
            key,
            Convert.ToHexString(hash).ToLowerInvariant());
    }

    private static string Canonicalize(object? value) => value switch
    {
        null => "<null>",
        DateOnly date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        DateTimeOffset timestamp => timestamp.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
        Guid identifier => identifier.ToString("D"),
        Enum enumeration => enumeration.ToString(),
        IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? string.Empty,
    };

    private static void Append(StringBuilder target, string value) =>
        target.Append(value.Length).Append(':').Append(value).Append('|');
}
