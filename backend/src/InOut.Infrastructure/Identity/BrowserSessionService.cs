using System.Security.Cryptography;
using System.Text;
using InOut.Application.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;

namespace InOut.Infrastructure.Identity;

public sealed record BrowserSessionIssue(
    string SessionId,
    string Csrf,
    string Purpose,
    IdentityUserView User,
    DateTimeOffset ExpiresAt,
    string? AccessToken,
    string? LoginTicket,
    string? PendingTicket = null,
    string? RefreshToken = null,
    DateTimeOffset? AccessExpiresAt = null);

public sealed class BrowserSessionService(
    IdentityDbContext db,
    UserManager<InOutUser> users,
    IdentityAccountService accounts,
    IDataProtectionProvider protection,
    IOpenIddictTokenManager tokens,
    TimeProvider clock)
{
    public const string AuthenticatedPurpose = "authenticated";
    public const string MfaPurpose = IdentityAccountService.MfaPurpose;
    public const string RecoveryPurpose = IdentityAccountService.RecoveryPurpose;
    public const string MfaEnrollPurpose = IdentityAccountService.MfaEnrollPurpose;
    private readonly IDataProtector protector = protection.CreateProtector("InOut.BrowserSession.v1");

    public async Task<BrowserSessionIssue?> CreateAuthenticatedAsync(
        string accessToken,
        string refreshToken,
        CancellationToken cancellationToken)
    {
        var access = await tokens.FindByReferenceIdAsync(accessToken, cancellationToken);
        var refresh = await tokens.FindByReferenceIdAsync(refreshToken, cancellationToken);
        var subject = access is null ? null : await tokens.GetSubjectAsync(access, cancellationToken);
        var refreshSubject = refresh is null ? null : await tokens.GetSubjectAsync(refresh, cancellationToken);
        if (string.IsNullOrEmpty(subject) ||
            !string.Equals(subject, refreshSubject, StringComparison.Ordinal) ||
            !Guid.TryParse(subject, out var userId))
        {
            return null;
        }

        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return null;
        }

        await RevokeActiveSessionsAsync(userId, cancellationToken);
        return await CreateAsync(user, AuthenticatedPurpose, pendingTicket: null, accessToken, refreshToken, cancellationToken);
    }

    public async Task<BrowserSessionIssue?> CreatePendingAsync(
        string ticket,
        string purpose,
        CancellationToken cancellationToken)
    {
        if (purpose is not (MfaPurpose or RecoveryPurpose or MfaEnrollPurpose))
        {
            return null;
        }

        var user = await PeekUserAsync(ticket, purpose, cancellationToken);
        if (user is null)
        {
            return null;
        }

        return await CreateAsync(user, purpose, ticket, access: null, refresh: null, cancellationToken);
    }

    public async Task<BrowserSessionIssue?> StoreTokensAsync(
        string sessionId,
        string accessToken,
        string refreshToken,
        CancellationToken cancellationToken)
    {
        var row = await FindAsync(sessionId, cancellationToken);
        if (row is null || row.RevokedAt is not null)
        {
            return null;
        }

        row.AccessTokenProtected = protector.Protect(accessToken);
        row.RefreshTokenProtected = protector.Protect(refreshToken);
        row.Purpose = AuthenticatedPurpose;
        row.PendingTicketProtected = null;
        row.AccessExpiresAt = clock.GetUtcNow().AddMinutes(10);
        await db.SaveChangesAsync(cancellationToken);
        var user = await users.FindByIdAsync(row.UserId.ToString());
        return user is null ? null : Issue(sessionId, row, user, accessToken, csrf: "");
    }

    public async Task<BrowserSessionIssue?> CompleteMfaAsync(
        string sessionId,
        string code,
        string password,
        CancellationToken cancellationToken)
    {
        var row = await FindAsync(sessionId, cancellationToken);
        if (row is null || row.PendingTicketProtected is null)
        {
            return null;
        }

        var ticket = protector.Unprotect(row.PendingTicketProtected);
        IdentityCommandResult result;
        if (row.Purpose == MfaPurpose)
        {
            result = await accounts.VerifyMfaAsync(ticket, code, cancellationToken);
        }
        else
        {
            var started = await accounts.StartMfaReenrollmentAsync(ticket, password, cancellationToken);
            if (!started.Succeeded)
            {
                return null;
            }

            result = await accounts.ConfirmMfaReenrollmentAsync(ticket, code, cancellationToken);
        }
        if (!result.Succeeded || result.Ticket is null || result.User is null)
        {
            return null;
        }

        await RevokeAsync(sessionId, cancellationToken);
        var user = await users.FindByIdAsync(result.User.Id.ToString());
        return user is null
            ? null
            : new BrowserSessionIssue(
                "",
                "",
                AuthenticatedPurpose,
                new IdentityUserView(user.Id, user.Email ?? "", user.EmailConfirmed, user.DisplayName),
                clock.GetUtcNow().Add(TimeSpan.FromMinutes(2)),
                AccessToken: null,
                LoginTicket: result.Ticket);
    }

    public async Task<BrowserSessionIssue?> RotateAsync(string sessionId, CancellationToken cancellationToken)
    {
        var row = await FindAsync(sessionId, cancellationToken);
        if (row is null)
        {
            return null;
        }

        var user = await users.FindByIdAsync(row.UserId.ToString());
        if (user is null || !StampMatches(row, user))
        {
            return null;
        }

        var now = clock.GetUtcNow();
        if (row.ExpiresAt <= now)
        {
            return null;
        }

        var claimed = await db.BrowserSessions
            .Where(item => item.Id == row.Id && item.RevokedAt == null)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.RevokedAt, now),
                cancellationToken);
        if (claimed != 1)
        {
            return null;
        }

        string? access = Unprotect(row.AccessTokenProtected);
        string? refresh = Unprotect(row.RefreshTokenProtected);
        string? pending = Unprotect(row.PendingTicketProtected);
        var next = await CreateAsync(
            user,
            row.Purpose,
            pending,
            access,
            refresh,
            cancellationToken,
            row.ExpiresAt,
            row.CreatedAt,
            row.AccessExpiresAt);
        await db.BrowserSessions
            .Where(item => item.Id == row.Id)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.ReplacedByHash, Hash(next.SessionId)),
                cancellationToken);
        return next;
    }

    public async Task<BrowserSessionIssue?> GetAsync(string sessionId, CancellationToken cancellationToken)
    {
        var row = await FindAsync(sessionId, cancellationToken);
        if (row is null)
        {
            return null;
        }

        var user = await users.FindByIdAsync(row.UserId.ToString());
        if (user is null || !StampMatches(row, user))
        {
            row.RevokedAt = clock.GetUtcNow();
            await db.SaveChangesAsync(cancellationToken);
            return null;
        }

        return Issue(
            sessionId,
            row,
            user,
            Unprotect(row.AccessTokenProtected),
            csrf: "",
            Unprotect(row.PendingTicketProtected),
            Unprotect(row.RefreshTokenProtected));
    }

    public async Task<bool> TryClaimRefreshAsync(string sessionId, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var hash = Hash(sessionId);
        var claimed = await db.BrowserSessions
            .Where(item => item.SessionHash == hash &&
                           item.RevokedAt == null &&
                           item.ExpiresAt > now &&
                           (item.RefreshClaimedAt == null || item.RefreshClaimedAt < now.AddSeconds(-10)))
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.RefreshClaimedAt, now),
                cancellationToken);
        return claimed == 1;
    }

    public async Task<BrowserSessionIssue?> CompleteRefreshAsync(
        string sessionId,
        string accessToken,
        string refreshToken,
        DateTimeOffset accessExpiresAt,
        CancellationToken cancellationToken)
    {
        var row = await FindAsync(sessionId, cancellationToken);
        if (row is null)
        {
            return null;
        }

        row.AccessTokenProtected = protector.Protect(accessToken);
        row.RefreshTokenProtected = protector.Protect(refreshToken);
        row.AccessExpiresAt = accessExpiresAt;
        row.RefreshClaimedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        var user = await users.FindByIdAsync(row.UserId.ToString());
        return user is null ? null : Issue(sessionId, row, user, accessToken, csrf: "", refreshToken: refreshToken);
    }

    public async Task<bool> CsrfMatchesAsync(string sessionId, string csrf, CancellationToken cancellationToken)
    {
        var row = await FindAsync(sessionId, cancellationToken);
        return row is not null && CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(row.CsrfHash),
            Encoding.UTF8.GetBytes(Hash(csrf)));
    }

    public async Task RevokeAsync(string sessionId, CancellationToken cancellationToken)
    {
        var row = await FindAsync(sessionId, cancellationToken);
        if (row is null)
        {
            return;
        }

        var refresh = Unprotect(row.RefreshTokenProtected);
        var access = Unprotect(row.AccessTokenProtected);
        foreach (var token in new[] { refresh, access })
        {
            if (string.IsNullOrEmpty(token))
            {
                continue;
            }

            var current = await tokens.FindByReferenceIdAsync(token, cancellationToken)
                ?? await tokens.FindByIdAsync(token, cancellationToken);
            if (current is not null)
            {
                await tokens.TryRevokeAsync(current, cancellationToken);
            }
        }

        row.RevokedAt = clock.GetUtcNow();
        row.AccessTokenProtected = null;
        row.RefreshTokenProtected = null;
        row.PendingTicketProtected = null;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task RevokeActiveSessionsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        await db.BrowserSessions
            .Where(item => item.UserId == userId && item.RevokedAt == null)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.RevokedAt, now),
                cancellationToken);
        await db.LoginTickets
            .Where(item => item.UserId == userId &&
                           item.Purpose == IdentityAccountService.LoginPurpose &&
                           item.ConsumedAt == null)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(item => item.ConsumedAt, now),
                cancellationToken);
    }

    private async Task<BrowserSessionIssue> CreateAsync(
        InOutUser user,
        string purpose,
        string? pendingTicket,
        string? access,
        string? refresh,
        CancellationToken cancellationToken,
        DateTimeOffset? absoluteExpiresAt = null,
        DateTimeOffset? createdAt = null,
        DateTimeOffset? accessExpiresAt = null)
    {
        var sessionId = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var csrf = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var lifetime = purpose == AuthenticatedPurpose ? TimeSpan.FromDays(14) : TimeSpan.FromMinutes(15);
        var now = clock.GetUtcNow();
        var created = createdAt ?? now;
        var expires = absoluteExpiresAt ?? created.Add(lifetime);
        db.BrowserSessions.Add(new BrowserSession
        {
            Id = Guid.NewGuid(),
            SessionHash = Hash(sessionId),
            UserId = user.Id,
            Purpose = purpose,
            CsrfHash = Hash(csrf),
            AccessTokenProtected = access is null ? null : protector.Protect(access),
            RefreshTokenProtected = refresh is null ? null : protector.Protect(refresh),
            PendingTicketProtected = pendingTicket is null ? null : protector.Protect(pendingTicket),
            CreatedAt = created,
            ExpiresAt = expires,
            AccessExpiresAt = access is null ? null : accessExpiresAt ?? now.AddMinutes(10),
            SecurityStamp = user.SecurityStamp ?? ""
        });
        await db.SaveChangesAsync(cancellationToken);
        return new BrowserSessionIssue(
            sessionId,
            csrf,
            purpose,
            new IdentityUserView(user.Id, user.Email ?? "", user.EmailConfirmed, user.DisplayName),
            expires,
            access,
            purpose == AuthenticatedPurpose ? pendingTicket : null,
            PendingTicket: purpose == AuthenticatedPurpose ? null : pendingTicket,
            RefreshToken: refresh,
            AccessExpiresAt: access is null ? null : accessExpiresAt ?? now.AddMinutes(10));
    }

    private async Task<BrowserSession?> FindAsync(string sessionId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            return null;
        }

        var now = clock.GetUtcNow();
        var hash = Hash(sessionId);
        return await db.BrowserSessions.SingleOrDefaultAsync(
            item => item.SessionHash == hash && item.RevokedAt == null && item.ExpiresAt > now,
            cancellationToken);
    }

    private async Task<InOutUser?> PeekUserAsync(string ticket, string purpose, CancellationToken cancellationToken)
    {
        var hash = IdentityAccountService.TicketHash(purpose, ticket);
        var now = clock.GetUtcNow();
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

        var user = await users.FindByIdAsync(row.UserId.ToString());
        if (user is null || !string.Equals(row.SecurityStamp, user.SecurityStamp, StringComparison.Ordinal))
        {
            return null;
        }

        return user;
    }

    private static bool StampMatches(BrowserSession row, InOutUser user) =>
        string.Equals(row.SecurityStamp, user.SecurityStamp, StringComparison.Ordinal);

    private static BrowserSessionIssue Issue(
        string sessionId,
        BrowserSession row,
        InOutUser user,
        string? access,
        string csrf,
        string? pendingTicket = null,
        string? refreshToken = null) =>
        new(
            sessionId,
            csrf,
            row.Purpose,
            new IdentityUserView(user.Id, user.Email ?? "", user.EmailConfirmed, user.DisplayName),
            row.ExpiresAt,
            access,
            LoginTicket: null,
            PendingTicket: pendingTicket,
            RefreshToken: refreshToken,
            AccessExpiresAt: row.AccessExpiresAt);

    private string? Unprotect(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        try
        {
            return protector.Unprotect(value);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    public static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
