namespace InOut.Application.Identity;

public static class IdentityCodes
{
    public const string AccountUnavailable = "account_unavailable";
    public const string ConfirmationRequired = "confirmation_required";
    public const string EmailNotConfirmed = "email_not_confirmed";
    public const string InvalidCredentials = "invalid_credentials";
    public const string InvalidToken = "invalid_token";
    public const string MfaReenrollmentRequired = "mfa_reenrollment_required";
    public const string PasswordResetRequired = "password_reset_required";
    public const string RateLimited = "over_email_send_rate_limit";
    public const string SignedIn = "signed_in";
    public const string WeakPassword = "weak_password";
}

public sealed record IdentityUserView(Guid Id, string Email, bool EmailConfirmed, string? DisplayName);

public sealed record IdentityCommandResult(
    bool Succeeded,
    string Code,
    IdentityUserView? User = null,
    string? Ticket = null,
    string? AuthenticatorKey = null,
    string? OtpAuthUri = null);

public sealed record IdentityMail(string To, string Subject, string Text);

public interface IIdentityMail
{
    Task SendAsync(IdentityMail message, CancellationToken cancellationToken);
}

public interface IIdentityAccounts
{
    Task<IdentityCommandResult> RegisterAsync(
        string email,
        string password,
        string displayName,
        CancellationToken cancellationToken);

    Task<IdentityCommandResult> ConfirmEmailAsync(
        string email,
        string code,
        CancellationToken cancellationToken);

    Task<IdentityCommandResult> ResendConfirmationAsync(
        string email,
        CancellationToken cancellationToken);

    Task<IdentityCommandResult> LoginAsync(
        string email,
        string password,
        CancellationToken cancellationToken);

    Task<IdentityCommandResult> StartMfaReenrollmentAsync(
        string ticket,
        CancellationToken cancellationToken);

    Task<IdentityCommandResult> ConfirmMfaReenrollmentAsync(
        string ticket,
        string code,
        CancellationToken cancellationToken);

    Task<IdentityCommandResult> RequestPasswordResetAsync(
        string email,
        CancellationToken cancellationToken);

    Task<IdentityCommandResult> ExchangeRecoveryCodeAsync(
        string email,
        string code,
        CancellationToken cancellationToken);

    Task<IdentityCommandResult> ResetPasswordAsync(
        string ticket,
        string password,
        CancellationToken cancellationToken);

    Task<IdentityUserView?> FindByIdAsync(Guid userId, CancellationToken cancellationToken);

    Task RevokeSessionsAsync(Guid userId, CancellationToken cancellationToken);
}

public sealed record ExportedLogin(string Provider, string? Issuer, string Subject);

public sealed record ExportedFactor(string Id, string Status, bool ContainsSecret);

public sealed record ExportedIdentityUser(
    Guid Id,
    string? Email,
    string? EncryptedPassword,
    DateTimeOffset? EmailConfirmedAt,
    DateTimeOffset? BannedUntil,
    string? DisplayName,
    bool IsBanned,
    IReadOnlyList<ExportedLogin> Logins,
    IReadOnlyList<ExportedFactor> Factors);

public enum PlannedPasswordKind
{
    Identity,
    Bcrypt,
    Missing,
    RequiresReset
}

public sealed record PlannedIdentityUser(
    Guid Id,
    string Email,
    string NormalizedEmail,
    string? DisplayName,
    bool EmailConfirmed,
    DateTimeOffset? BannedUntil,
    bool MfaReenrollmentRequired,
    PlannedPasswordKind PasswordKind,
    string? PasswordHash,
    IReadOnlyList<ExportedLogin> Logins);

public sealed record IdentityImportPlan(
    bool Accepted,
    string Code,
    IReadOnlyList<PlannedIdentityUser> Users,
    IReadOnlyDictionary<string, int> Counts);

public static class LegacyIdentityImportPlanner
{
    public static IdentityImportPlan Plan(
        IReadOnlyList<ExportedIdentityUser> rows,
        DateTimeOffset now)
    {
        var counts = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            ["input"] = rows.Count,
            ["accepted"] = 0,
            ["email_confirmed"] = 0,
            ["unconfirmed"] = 0,
            ["banned"] = 0,
            ["bcrypt"] = 0,
            ["identity_hash"] = 0,
            ["password_missing"] = 0,
            ["password_reset_required"] = 0,
            ["mfa_reenroll"] = 0,
            ["mfa_secrets_withheld"] = 0,
            ["provider_links"] = 0
        };
        var planned = new List<PlannedIdentityUser>(rows.Count);
        var emails = new Dictionary<string, Guid>(StringComparer.Ordinal);
        var providers = new Dictionary<string, Guid>(StringComparer.Ordinal);
        var ids = new HashSet<Guid>();
        foreach (var row in rows.OrderBy(item => item.Id))
        {
            if (!ids.Add(row.Id))
            {
                return Reject("duplicate_user_id", counts);
            }

            var email = NormalizeEmail(row.Email);
            if (email is null)
            {
                return Reject("invalid_email", counts);
            }

            if (!emails.TryAdd(email, row.Id))
            {
                return Reject("normalized_email_collision", counts);
            }

            foreach (var login in row.Logins)
            {
                if (string.IsNullOrWhiteSpace(login.Subject))
                {
                    return Reject("provider_subject_missing", counts);
                }

                var key = ProviderKey(login);
                if (!providers.TryAdd(key, row.Id))
                {
                    return Reject("provider_subject_collision", counts);
                }
            }

            var password = ClassifyPassword(row.EncryptedPassword);
            var mfa = row.Factors.Count > 0;
            if (row.Factors.Any(factor => factor.ContainsSecret))
            {
                counts["mfa_secrets_withheld"]++;
            }

            if (row.EmailConfirmedAt is not null)
            {
                counts["email_confirmed"]++;
            }
            else
            {
                counts["unconfirmed"]++;
            }

            var bannedUntil = row.BannedUntil;
            var banned = row.IsBanned || (bannedUntil is not null && bannedUntil > now);
            if (banned)
            {
                counts["banned"]++;
                bannedUntil ??= now.AddYears(100);
            }

            counts[password.Counter]++;
            if (mfa)
            {
                counts["mfa_reenroll"]++;
            }

            counts["provider_links"] += row.Logins.Count;
            planned.Add(new PlannedIdentityUser(
                row.Id,
                email.ToLowerInvariant(),
                email,
                string.IsNullOrWhiteSpace(row.DisplayName) ? null : row.DisplayName.Trim(),
                row.EmailConfirmedAt is not null,
                banned ? bannedUntil : null,
                mfa,
                password.Kind,
                password.Hash,
                row.Logins));
        }

        counts["accepted"] = planned.Count;
        if (counts["accepted"] != counts["input"])
        {
            return Reject("row_count_mismatch", counts);
        }

        return new IdentityImportPlan(true, "accepted", planned, counts);
    }

    public static string? NormalizeEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var trimmed = email.Trim();
        if (trimmed.Length > 320 || !trimmed.Contains('@', StringComparison.Ordinal))
        {
            return null;
        }

        return trimmed.ToUpperInvariant();
    }

    public static string ProviderKey(ExportedLogin login)
    {
        var issuer = string.IsNullOrWhiteSpace(login.Issuer)
            ? login.Provider.Trim()
            : login.Issuer.Trim();
        return issuer + "\n" + login.Subject.Trim();
    }

    private static IdentityImportPlan Reject(
        string code,
        Dictionary<string, int> counts) =>
        new(false, code, [], counts);

    private static (PlannedPasswordKind Kind, string? Hash, string Counter) ClassifyPassword(string? hash)
    {
        if (string.IsNullOrWhiteSpace(hash))
        {
            return (PlannedPasswordKind.Missing, null, "password_missing");
        }

        if (hash.StartsWith("$2a$", StringComparison.Ordinal) ||
            hash.StartsWith("$2b$", StringComparison.Ordinal))
        {
            return (PlannedPasswordKind.Bcrypt, hash, "bcrypt");
        }

        if (hash.StartsWith("AQAAAA", StringComparison.Ordinal))
        {
            return (PlannedPasswordKind.Identity, hash, "identity_hash");
        }

        return (PlannedPasswordKind.RequiresReset, hash, "password_reset_required");
    }
}

public static class IdentityImportGate
{
    public const string Rehearsal = "rehearsal";
    public const string ApprovedCutover = "approved-cutover";

    public static void Require(string? mode, bool production)
    {
        if (string.Equals(mode, Rehearsal, StringComparison.Ordinal))
        {
            if (production)
            {
                throw new InvalidOperationException(
                    "Identity import rehearsal is refused in production.");
            }

            return;
        }

        if (string.Equals(mode, ApprovedCutover, StringComparison.Ordinal))
        {
            return;
        }

        throw new InvalidOperationException(
            "IdentityImport:Mode must be rehearsal or approved-cutover. Import is refused.");
    }
}
