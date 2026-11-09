using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using InOut.Application.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;

namespace InOut.Infrastructure.Identity;

public sealed class IdentityAccountService(
    IdentityDbContext db,
    UserManager<InOutUser> users,
    IOpenIddictTokenManager tokens,
    IIdentityMail mail,
    TimeProvider clock) : IIdentityAccounts
{
    public const string LoginPurpose = "login";
    public const string MfaPurpose = "mfa";
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
                        "Se você já tem uma conta, entre com sua senha ou redefina-a. Nenhuma conta nova foi criada.",
                        EmailTemplates.ExistingAccountEmailHtml()),
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
        await users.UpdateAsync(user);
        var ticket = await IssueTicketAsync(user.Id, LoginPurpose, TicketLifetime, cancellationToken);
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

        if (user.MfaReenrollmentRequired || user.TwoFactorEnabled)
        {
            var ticket = await IssueTicketAsync(user.Id, MfaPurpose, MfaTicketLifetime, cancellationToken);
            return new IdentityCommandResult(false, IdentityCodes.MfaReenrollmentRequired, View(user), ticket);
        }

        var login = await IssueTicketAsync(user.Id, LoginPurpose, TicketLifetime, cancellationToken);
        return new IdentityCommandResult(true, IdentityCodes.SignedIn, View(user), login);
    }

    public async Task<IdentityCommandResult> StartMfaReenrollmentAsync(
        string ticket,
        CancellationToken cancellationToken)
    {
        var user = await RequireTicketUserAsync(ticket, MfaPurpose, consume: false, cancellationToken);
        if (user is null)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        if (!user.MfaReenrollmentRequired && !string.IsNullOrEmpty(await users.GetAuthenticatorKeyAsync(user)))
        {
            return new IdentityCommandResult(true, IdentityCodes.MfaReenrollmentRequired, View(user), ticket);
        }

        await users.ResetAuthenticatorKeyAsync(user);
        var key = await users.GetAuthenticatorKeyAsync(user);
        var uri = $"otpauth://totp/InOut:{Uri.EscapeDataString(user.Email!)}?secret={key}&issuer=InOut&digits=6";
        return new IdentityCommandResult(true, IdentityCodes.MfaReenrollmentRequired, View(user), ticket, key, uri);
    }

    public async Task<IdentityCommandResult> ConfirmMfaReenrollmentAsync(
        string ticket,
        string code,
        CancellationToken cancellationToken)
    {
        var user = await RequireTicketUserAsync(ticket, MfaPurpose, consume: false, cancellationToken);
        if (user is null)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        var valid = await users.VerifyTwoFactorTokenAsync(
            user,
            TokenOptions.DefaultAuthenticatorProvider,
            code.Replace(" ", "", StringComparison.Ordinal));
        if (!valid)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        await ConsumeTicketAsync(ticket, MfaPurpose, cancellationToken);
        user.TwoFactorEnabled = true;
        user.MfaReenrollmentRequired = false;
        await users.UpdateAsync(user);
        var login = await IssueTicketAsync(user.Id, LoginPurpose, TicketLifetime, cancellationToken);
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

        var ticket = await IssueTicketAsync(user.Id, RecoveryPurpose, RecoveryTicketLifetime, cancellationToken);
        return new IdentityCommandResult(true, IdentityCodes.SignedIn, View(user), ticket);
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

        var user = await RequireTicketUserAsync(ticket, RecoveryPurpose, consume: true, cancellationToken);
        if (user is null)
        {
            return Fail(IdentityCodes.InvalidToken);
        }

        user.PasswordHash = users.PasswordHasher.HashPassword(user, password);
        await users.UpdateAsync(user);
        await RevokeSessionsAsync(user.Id, cancellationToken);
        return new IdentityCommandResult(true, IdentityCodes.SignedIn, View(user));
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

        var user = await users.FindByIdAsync(userId.ToString());
        if (user is not null)
        {
            await users.UpdateSecurityStampAsync(user);
        }
    }

    public async Task<InOutUser?> RedeemLoginTicketAsync(
        string ticket,
        CancellationToken cancellationToken) =>
        await RequireTicketUserAsync(ticket, LoginPurpose, consume: true, cancellationToken);

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
            CreatedAt = now,
            ExpiresAt = now.Add(lifetime)
        });
        await db.SaveChangesAsync(cancellationToken);
        var path = purpose == ResetPurpose ? "/auth/recuperar" : "/auth/callback";
        var link = $"{PublicOrigin.TrimEnd('/')}{path}?email={Uri.EscapeDataString(user.Email!)}&code={code}";
        var subject = purpose == ResetPurpose ? "Redefinir senha do InOut" : "Confirmar e-mail do InOut";
        var minutes = (int)lifetime.TotalMinutes;
        var html = purpose == ResetPurpose
            ? EmailTemplates.PasswordResetEmailHtml(code, link, minutes)
            : EmailTemplates.ConfirmationEmailHtml(code, link, minutes);
        await mail.SendAsync(
            new IdentityMail(
                user.Email!,
                subject,
                $"Código {code}. Ele expira em {minutes} minutos e só pode ser usado uma vez. {link}",
                html),
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
        var challenge = await db.EmailChallenges.SingleOrDefaultAsync(
            item => item.UserId == user.Id &&
                    item.Purpose == purpose &&
                    item.CodeHash == hash &&
                    item.ConsumedAt == null &&
                    item.ExpiresAt > now,
            cancellationToken);
        if (challenge is null)
        {
            return false;
        }

        challenge.ConsumedAt = now;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<string> IssueTicketAsync(
        Guid userId,
        string purpose,
        TimeSpan lifetime,
        CancellationToken cancellationToken)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        db.LoginTickets.Add(new LoginTicket
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Purpose = purpose,
            TokenHash = TicketHash(purpose, token),
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
                    item.ExpiresAt > now,
            cancellationToken);
        if (row is null)
        {
            return null;
        }

        if (consume)
        {
            row.ConsumedAt = now;
            await db.SaveChangesAsync(cancellationToken);
        }

        var user = await users.FindByIdAsync(row.UserId.ToString());
        return user is null || IsBanned(user) ? null : user;
    }

    private async Task ConsumeTicketAsync(string ticket, string purpose, CancellationToken cancellationToken) =>
        await RequireTicketUserAsync(ticket, purpose, consume: true, cancellationToken);

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
