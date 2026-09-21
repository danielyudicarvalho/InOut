namespace InOut.Application.Idempotency;

public static class IdempotencyErrorCodes
{
    public const string Conflict = "idempotency_conflict";
    public const string Failed = "idempotency_failed";
    public const string InProgress = "idempotency_in_progress";
    public const string InvalidKey = "invalid_idempotency_key";
    public const string InvalidScope = "invalid_idempotency_scope";
    public const string MessageIdentityConflict = "message_identity_conflict";
}
