using System.Data;
using System.Data.Common;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using InOut.Application.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using OpenIddict.Abstractions;

namespace InOut.Infrastructure.Identity;

public sealed class IdentityAccountService(
    IdentityDbContext db,
    UserManager<InOutUser> users,
    IOpenIddictTokenManager tokens,
    IIdentityMail mail,
    TimeProvider clock,
    AuthAttemptBudget attempts) : IIdentityAccounts
{
    public const string LoginPurpose = "login";
    public const string MfaPurpose = "mfa";
    public const string MfaEnrollPurpose = "mfa-enroll";
    public const string RecoveryPurpose = "recovery";
    public const string ConfirmPurpose = "confirm";
    public const string ResetPurpose = "reset";

    private static readonly TimeSpan ConfirmLifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan ResetLifetime = TimeSpan.FromHours(1);
    private static readonly TimeSpan TicketLifetime = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan RecoveryTicketLifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan MfaTicketLifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan SendCooldown = TimeSpan.FromMinutes(1);
    private static readonly InOutUser DummyUser = new();
    private static readonly string DummyHash = new PasswordHasher<InOutUser>().HashPassword(DummyUser, "InOutDummyPassword123!");

    public async Task<IdentityCommandResult> RegisterAsync(
        string email,
        string password,
        string displayName,
        CancellationToken cancellationToken)
    {
        var normalized = LegacyIdentityImportPlanner.NormalizeEmail(email);
        if (normalized is null)
        {
            return Fail(IdentityCodes.InvalidCredentials);
        }

        if (password.Length < 8)
        {
            return Fail(IdentityCodes.WeakPassword);
        }

        var existing = await users.FindByEmailAsync(normalized);
        if (existing is not null)
        {
            if (!existing.EmailConfirmed)
            {
                await IssueEmailChallengeAsync(existing, ConfirmPurpose, ConfirmLifetime, cancellationToken);
            }
            else
            {
                await mail.SendAsync(
                    new IdentityMail(
                        existing.Email!,
                        "Conta InOut",
                        "Se você já tem uma conta, entre com sua senha ou redefina-a. Nenhuma conta nova foi criada."),
                    cancellationToken);
            }

            return new IdentityCommandResult(true, IdentityCodes.ConfirmationRequired);
        }

        var user = new InOutUser
        {
            Id = Guid.NewGuid(),
            UserName = normalized.ToLowerInvariant(),
            Email = normalized.ToLowerInvariant(),
            DisplayName = displayName.Trim(),
            EmailConfirmed = false,
            LockoutEnabled = true,
            TwoFactorEnabled = false
        };
        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            return Fail(IdentityCodes.WeakPassword);
        }

        await IssueEmailChallengeAsync(user, ConfirmPurpose, ConfirmLifetime, cancellationToken);
        return new IdentityCommandResult(true, IdentityCodes.ConfirmationRequired, View(user));
    }

    public async Task<IdentityCommandResult> ConfirmEmailAsync(
        string email,
        string code,
        CancellationToken cancellationToken)
    {
        var user = await RequireUserAsync(email);
        if (user is null || !await ConsumeChallengeAsync(user, ConfirmPurpose, code, cancellationToken))
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        user.EmailConfirmed = true;
        IdentityImporter.EnsureSucceeded(await users.UpdateAsync(user), "confirm-email");
        var ticket = await IssueTicketAsync(user, LoginPurpose, TicketLifetime, cancellationToken);
        return new IdentityCommandResult(true, IdentityCodes.SignedIn, View(user), ticket);
    }

    public async Task<IdentityCommandResult> ResendConfirmationAsync(
        string email,
        CancellationToken cancellationToken)
    {
        var user = await RequireUserAsync(email);
        if (user is { EmailConfirmed: false })
        {
            var issued = await IssueEmailChallengeAsync(user, ConfirmPurpose, ConfirmLifetime, cancellationToken);
            if (!issued)
            {
                return Fail(IdentityCodes.RateLimited);
            }
        }

        return new IdentityCommandResult(true, IdentityCodes.ConfirmationRequired);
    }

    public async Task<IdentityCommandResult> LoginAsync(
        string email,
        string password,
        CancellationToken cancellationToken)
    {
        var user = await RequireUserAsync(email);
        if (user is null)
        {
            users.PasswordHasher.VerifyHashedPassword(DummyUser, DummyHash, password);
            return Fail(IdentityCodes.InvalidCredentials);
        }

        if (await users.IsLockedOutAsync(user))
        {
            return Fail(IdentityCodes.AccountUnavailable);
        }

        if (LegacyPasswordVerifier.Verify(user.PasswordHash, password) ==
            LegacyPasswordStatus.RequiresReset)
        {
            return Fail(IsBanned(user)
                ? IdentityCodes.AccountUnavailable
                : IdentityCodes.PasswordResetRequired);
        }

        var check = await users.CheckPasswordAsync(user, password);
        if (!check)
        {
            await users.AccessFailedAsync(user);
            await attempts.TryAccountFailureAsync(user.Email ?? email, cancellationToken);
            return Fail(IdentityCodes.InvalidCredentials);
        }

        await users.ResetAccessFailedCountAsync(user);
        if (IsBanned(user))
        {
            return Fail(IdentityCodes.AccountUnavailable);
        }

        if (!user.EmailConfirmed)
        {
            return Fail(IdentityCodes.EmailNotConfirmed);
        }

        if (user.MfaReenrollmentRequired)
        {
            return new IdentityCommandResult(false, IdentityCodes.MfaRecoveryRequired, View(user));
        }

        if (user.TwoFactorEnabled)
        {
            var key = await users.GetAuthenticatorKeyAsync(user);
            if (string.IsNullOrEmpty(key))
            {
                return new IdentityCommandResult(false, IdentityCodes.MfaRecoveryRequired, View(user));
            }

            var mfa = await IssueTicketAsync(user, MfaPurpose, MfaTicketLifetime, cancellationToken);
            return new IdentityCommandResult(false, IdentityCodes.MfaRequired, View(user), mfa);
        }

        var login = await IssueTicketAsync(user, LoginPurpose, TicketLifetime, cancellationToken);
        return new IdentityCommandResult(true, IdentityCodes.SignedIn, View(user), login);
    }

    public async Task<IdentityCommandResult> StartMfaReenrollmentAsync(
        string ticket,
        CancellationToken cancellationToken)
    {
        var user = await RequireTicketUserAsync(ticket, MfaEnrollPurpose, consume: false, cancellationToken)
            ?? await RequireTicketUserAsync(ticket, RecoveryPurpose, consume: false, cancellationToken);
        if (user is null)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        if (!user.MfaReenrollmentRequired)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        IdentityImporter.EnsureSucceeded(await users.ResetAuthenticatorKeyAsync(user), "mfa-reset-key");
        user = await users.FindByIdAsync(user.Id.ToString()) ?? user;
        await db.LoginTickets
            .Where(item => item.UserId == user.Id &&
                           item.ConsumedAt == null &&
                           (item.Purpose == MfaEnrollPurpose || item.Purpose == RecoveryPurpose))
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.SecurityStamp, user.SecurityStamp ?? ""),
                cancellationToken);
        var key = await users.GetAuthenticatorKeyAsync(user);
        var uri = $"otpauth://totp/InOut:{Uri.EscapeDataString(user.Email!)}?secret={key}&issuer=InOut&digits=6";
        return new IdentityCommandResult(true, IdentityCodes.MfaReenrollmentRequired, View(user), ticket, key, uri);
    }

    public async Task<IdentityCommandResult> ConfirmMfaReenrollmentAsync(
        string ticket,
        string code,
        CancellationToken cancellationToken)
    {
        var user = await RequireTicketUserAsync(ticket, MfaEnrollPurpose, consume: false, cancellationToken)
            ?? await RequireTicketUserAsync(ticket, RecoveryPurpose, consume: false, cancellationToken);
        if (user is null || !user.MfaReenrollmentRequired)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        user = await users.FindByIdAsync(user.Id.ToString()) ?? user;
        var valid = await users.VerifyTwoFactorTokenAsync(
            user,
            TokenOptions.DefaultAuthenticatorProvider,
            code.Replace(" ", "", StringComparison.Ordinal));
        if (!valid)
        {
            await RegisterTicketFailureAsync(ticket, [MfaEnrollPurpose, RecoveryPurpose], cancellationToken);
            return Fail(IdentityCodes.InvalidToken);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var consumed = await ConsumeTicketAsync(ticket, MfaEnrollPurpose, cancellationToken)
            || await ConsumeTicketAsync(ticket, RecoveryPurpose, cancellationToken);
        if (!consumed)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        user.TwoFactorEnabled = true;
        user.MfaReenrollmentRequired = false;
        IdentityImporter.EnsureSucceeded(await users.UpdateAsync(user), "mfa-enroll");
        var login = await IssueTicketAsync(user, LoginPurpose, TicketLifetime, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new IdentityCommandResult(true, IdentityCodes.SignedIn, View(user), login);
    }

    public async Task<IdentityCommandResult> VerifyMfaAsync(
        string ticket,
        string code,
        CancellationToken cancellationToken)
    {
        var user = await RequireTicketUserAsync(ticket, MfaPurpose, consume: false, cancellationToken);
        if (user is null || user.MfaReenrollmentRequired || !user.TwoFactorEnabled)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        var valid = await users.VerifyTwoFactorTokenAsync(
            user,
            TokenOptions.DefaultAuthenticatorProvider,
            code.Replace(" ", "", StringComparison.Ordinal));
        if (!valid)
        {
            await RegisterTicketFailureAsync(ticket, [MfaPurpose], cancellationToken);
            return Fail(IdentityCodes.InvalidToken);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        if (!await ConsumeTicketAsync(ticket, MfaPurpose, cancellationToken))
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        var login = await IssueTicketAsync(user, LoginPurpose, TicketLifetime, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new IdentityCommandResult(true, IdentityCodes.SignedIn, View(user), login);
    }

    public async Task<IdentityCommandResult> RequestPasswordResetAsync(
        string email,
        CancellationToken cancellationToken)
    {
        var user = await RequireUserAsync(email);
        if (user is not null && !IsBanned(user))
        {
            await IssueEmailChallengeAsync(user, ResetPurpose, ResetLifetime, cancellationToken);
        }

        return new IdentityCommandResult(true, IdentityCodes.ConfirmationRequired);
    }

    public async Task<IdentityCommandResult> ExchangeRecoveryCodeAsync(
        string email,
        string code,
        CancellationToken cancellationToken)
    {
        var user = await RequireUserAsync(email);
        if (user is null || !await ConsumeChallengeAsync(user, ResetPurpose, code, cancellationToken))
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        var purpose = user.MfaReenrollmentRequired ? MfaEnrollPurpose : RecoveryPurpose;
        var ticket = await IssueTicketAsync(user, purpose, RecoveryTicketLifetime, cancellationToken);
        var resultCode = user.MfaReenrollmentRequired
            ? IdentityCodes.MfaReenrollmentRequired
            : IdentityCodes.SignedIn;
        return new IdentityCommandResult(true, resultCode, View(user), ticket);
    }

    public async Task<IdentityCommandResult> ResetPasswordAsync(
        string ticket,
        string password,
        CancellationToken cancellationToken)
    {
        if (password.Length < 8)
        {
            return Fail(IdentityCodes.WeakPassword);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var user = await RequireTicketUserAsync(ticket, RecoveryPurpose, consume: true, cancellationToken)
            ?? await RequireTicketUserAsync(ticket, MfaEnrollPurpose, consume: true, cancellationToken);
        if (user is null)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        user.PasswordHash = users.PasswordHasher.HashPassword(user, password);
        IdentityImporter.EnsureSucceeded(await users.UpdateAsync(user), "reset-password");
        await RevokeSessionsAsync(user.Id, cancellationToken);
        IdentityCommandResult result;
        if (user.MfaReenrollmentRequired)
        {
            user = await users.FindByIdAsync(user.Id.ToString()) ?? user;
            var enroll = await IssueTicketAsync(user, MfaEnrollPurpose, RecoveryTicketLifetime, cancellationToken);
            result = new IdentityCommandResult(true, IdentityCodes.MfaReenrollmentRequired, View(user), enroll);
        }
        else
        {
            result = new IdentityCommandResult(true, IdentityCodes.SignedIn, View(user));
        }

        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task<IdentityUserView?> FindByIdAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        return user is null ? null : View(user);
    }

    public async Task RevokeSessionsAsync(Guid userId, CancellationToken cancellationToken)
    {
        await foreach (var token in tokens.FindBySubjectAsync(userId.ToString(), cancellationToken))
        {
            await tokens.TryRevokeAsync(token, cancellationToken);
        }

        var now = clock.GetUtcNow();
        await db.LoginTickets
            .Where(item => item.UserId == userId && item.ConsumedAt == null)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.ConsumedAt, now),
                cancellationToken);
        await db.EmailChallenges
            .Where(item => item.UserId == userId && item.ConsumedAt == null)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.ConsumedAt, now),
                cancellationToken);
        await db.BrowserSessions
            .Where(item => item.UserId == userId && item.RevokedAt == null)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.RevokedAt, now),
                cancellationToken);

        var user = await users.FindByIdAsync(userId.ToString());
        if (user is not null)
        {
            IdentityImporter.EnsureSucceeded(await users.UpdateSecurityStampAsync(user), "security-stamp");
        }
    }

    public async Task<InOutUser?> RedeemLoginTicketAsync(
        string ticket,
        CancellationToken cancellationToken) =>
        await ConsumeTicketUserAsync(ticket, LoginPurpose, cancellationToken);

    private bool IsBanned(InOutUser user) =>
        user.BannedUntil is not null && user.BannedUntil > clock.GetUtcNow();

    private async Task<InOutUser?> RequireUserAsync(string email)
    {
        var normalized = LegacyIdentityImportPlanner.NormalizeEmail(email);
        return normalized is null ? null : await users.FindByEmailAsync(normalized);
    }

    private async Task<bool> IssueEmailChallengeAsync(
        InOutUser user,
        string purpose,
        TimeSpan lifetime,
        CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var cooldown = now - SendCooldown;
        var recent = await db.EmailChallenges.AnyAsync(
            item => item.UserId == user.Id &&
                    item.Purpose == purpose &&
                    item.CreatedAt > cooldown,
            cancellationToken);
        if (recent)
        {
            return false;
        }

        await db.EmailChallenges
            .Where(item => item.UserId == user.Id && item.Purpose == purpose && item.ConsumedAt == null)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.ConsumedAt, now),
                cancellationToken);
        var code = RandomNumberGenerator.GetInt32(0, 100_000_000).ToString("D8", CultureInfo.InvariantCulture);
        db.EmailChallenges.Add(new EmailChallenge
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Purpose = purpose,
            CodeHash = Hash(purpose, user.Id, code),
            SecurityStamp = user.SecurityStamp ?? "",
            CreatedAt = now,
            ExpiresAt = now.Add(lifetime)
        });
        await db.SaveChangesAsync(cancellationToken);
        var path = purpose == ResetPurpose ? "/auth/recuperar" : "/auth/callback";
        var link = $"{PublicOrigin.TrimEnd('/')}{path}?email={Uri.EscapeDataString(user.Email!)}&code={code}";
        var subject = purpose == ResetPurpose ? "Redefinir senha do InOut" : "Confirmar e-mail do InOut";
        await mail.SendAsync(
            new IdentityMail(
                user.Email!,
                subject,
                $"Código {code}. Ele expira em {(int)lifetime.TotalMinutes} minutos e só pode ser usado uma vez. {link}"),
            cancellationToken);
        return true;
    }

    private async Task<bool> ConsumeChallengeAsync(
        InOutUser user,
        string purpose,
        string code,
        CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var hash = Hash(purpose, user.Id, code.Trim());
        var stamp = user.SecurityStamp ?? "";
        var redeemed = await AtomicConsumeAsync(
            postgresSql: """
                update identity.email_challenges
                set consumed_at = @now
                where user_id = @user_id
                  and purpose = @purpose
                  and code_hash = @hash
                  and security_stamp = @stamp
                  and consumed_at is null
                  and failed_attempts < @limit
                  and expires_at > @now
                returning user_id
                """,
            sqlite: () => db.EmailChallenges
                .Where(item => item.UserId == user.Id &&
                               item.Purpose == purpose &&
                               item.CodeHash == hash &&
                               item.SecurityStamp == stamp &&
                               item.ConsumedAt == null &&
                               item.FailedAttempts < AuthAttemptBudget.ChallengeFailureLimit &&
                               item.ExpiresAt > now)
                .ExecuteUpdateAsync(
                    updates => updates.SetProperty(item => item.ConsumedAt, now),
                    cancellationToken),
            bind: command =>
            {
                AddParameter(command, "now", now.ToUnixTimeMilliseconds());
                AddParameter(command, "user_id", user.Id);
                AddParameter(command, "purpose", purpose);
                AddParameter(command, "hash", hash);
                AddParameter(command, "stamp", stamp);
                AddParameter(command, "limit", AuthAttemptBudget.ChallengeFailureLimit);
            },
            cancellationToken);
        if (redeemed)
        {
            return true;
        }

        await db.EmailChallenges
            .Where(item => item.UserId == user.Id &&
                           item.Purpose == purpose &&
                           item.ConsumedAt == null &&
                           item.ExpiresAt > now)
            .ExecuteUpdateAsync(
                updates => updates
                    .SetProperty(item => item.FailedAttempts, item => item.FailedAttempts + 1)
                    .SetProperty(
                        item => item.ConsumedAt,
                        item => item.FailedAttempts + 1 >= AuthAttemptBudget.ChallengeFailureLimit ? now : item.ConsumedAt),
                cancellationToken);
        await attempts.TryAccountFailureAsync(user.Email ?? user.Id.ToString(), cancellationToken);
        return false;
    }

    private async Task<string> IssueTicketAsync(
        InOutUser user,
        string purpose,
        TimeSpan lifetime,
        CancellationToken cancellationToken)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        db.LoginTickets.Add(new LoginTicket
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Purpose = purpose,
            TokenHash = TicketHash(purpose, token),
            SecurityStamp = user.SecurityStamp ?? "",
            ExpiresAt = clock.GetUtcNow().Add(lifetime)
        });
        await db.SaveChangesAsync(cancellationToken);
        return token;
    }

    private async Task<InOutUser?> RequireTicketUserAsync(
        string ticket,
        string purpose,
        bool consume,
        CancellationToken cancellationToken)
    {
        if (consume)
        {
            return await ConsumeTicketUserAsync(ticket, purpose, cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(ticket))
        {
            return null;
        }

        var now = clock.GetUtcNow();
        var hash = TicketHash(purpose, ticket);
        var row = await db.LoginTickets.SingleOrDefaultAsync(
            item => item.Purpose == purpose &&
                    item.TokenHash == hash &&
                    item.ConsumedAt == null &&
                    item.FailedAttempts < AuthAttemptBudget.ChallengeFailureLimit &&
                    item.ExpiresAt > now,
            cancellationToken);
        if (row is null)
        {
            return null;
        }

        var user = await users.FindByIdAsync(row.UserId.ToString());
        if (user is null || IsBanned(user) || !string.Equals(row.SecurityStamp, user.SecurityStamp, StringComparison.Ordinal))
        {
            return null;
        }

        return user;
    }

    private async Task<bool> ConsumeTicketAsync(string ticket, string purpose, CancellationToken cancellationToken)
    {
        var user = await ConsumeTicketUserAsync(ticket, purpose, cancellationToken);
        return user is not null;
    }

    private async Task<InOutUser?> ConsumeTicketUserAsync(
        string ticket,
        string purpose,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(ticket))
        {
            return null;
        }

        var now = clock.GetUtcNow();
        var hash = TicketHash(purpose, ticket);
        Guid? userId = null;
        string? stamp = null;
        if (db.Database.IsNpgsql())
        {
            var connection = db.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await db.Database.OpenConnectionAsync(cancellationToken);
            }

            await using var command = connection.CreateCommand();
            command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
            command.CommandText = """
                update identity.login_tickets
                set consumed_at = @now
                where purpose = @purpose
                  and token_hash = @hash
                  and consumed_at is null
                  and failed_attempts < @limit
                  and expires_at > @now
                returning user_id, security_stamp
                """;
            AddParameter(command, "now", now.ToUnixTimeMilliseconds());
            AddParameter(command, "purpose", purpose);
            AddParameter(command, "hash", hash);
            AddParameter(command, "limit", AuthAttemptBudget.ChallengeFailureLimit);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                userId = reader.GetGuid(0);
                stamp = reader.GetString(1);
            }
        }
        else
        {
            var affected = await db.LoginTickets
                .Where(item => item.Purpose == purpose &&
                               item.TokenHash == hash &&
                               item.ConsumedAt == null &&
                               item.FailedAttempts < AuthAttemptBudget.ChallengeFailureLimit &&
                               item.ExpiresAt > now)
                .ExecuteUpdateAsync(
                    updates => updates.SetProperty(item => item.ConsumedAt, now),
                    cancellationToken);
            if (affected == 1)
            {
                var row = await db.LoginTickets.AsNoTracking().SingleAsync(
                    item => item.Purpose == purpose && item.TokenHash == hash,
                    cancellationToken);
                userId = row.UserId;
                stamp = row.SecurityStamp;
            }
        }

        if (userId is null || stamp is null)
        {
            return null;
        }

        var user = await users.FindByIdAsync(userId.Value.ToString());
        if (user is null || IsBanned(user) || !string.Equals(stamp, user.SecurityStamp, StringComparison.Ordinal))
        {
            return null;
        }

        return user;
    }

    private async Task<bool> AtomicConsumeAsync(
        string postgresSql,
        Func<Task<int>> sqlite,
        Action<DbCommand> bind,
        CancellationToken cancellationToken)
    {
        if (!db.Database.IsNpgsql())
        {
            return await sqlite() == 1;
        }

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await db.Database.OpenConnectionAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
        command.CommandText = postgresSql;
        bind(command);
        var scalar = await command.ExecuteScalarAsync(cancellationToken);
        return scalar is not null && scalar is not DBNull;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private async Task RegisterTicketFailureAsync(
        string ticket,
        IReadOnlyList<string> purposes,
        CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        foreach (var purpose in purposes)
        {
            var hash = TicketHash(purpose, ticket);
            await db.LoginTickets
                .Where(item => item.Purpose == purpose &&
                               item.TokenHash == hash &&
                               item.ConsumedAt == null)
                .ExecuteUpdateAsync(
                    updates => updates
                        .SetProperty(item => item.FailedAttempts, item => item.FailedAttempts + 1)
                        .SetProperty(
                            item => item.ConsumedAt,
                            item => item.FailedAttempts + 1 >= AuthAttemptBudget.ChallengeFailureLimit ? now : item.ConsumedAt),
                    cancellationToken);
        }
    }

    public static string TicketHash(string purpose, string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{purpose}:{token.Trim()}")));

    public static string Hash(string purpose, Guid userId, string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{purpose}:{userId:N}:{value.Trim()}"));
        return Convert.ToHexString(bytes);
    }

    public string PublicOrigin { get; set; } = "http://localhost:8080";

    private static IdentityCommandResult Fail(string code) => new(false, code);

    private static IdentityUserView View(InOutUser user) =>
        new(user.Id, user.Email ?? "", user.EmailConfirmed, user.DisplayName);
}
