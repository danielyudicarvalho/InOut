using System.Security.Cryptography;
using InOut.Infrastructure.Identity;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace InOut.Api.Identity;

public sealed class IdentityTokenIssuer(IOpenIddictTokenManager tokens)
{
    public async Task<(string Access, string Refresh, DateTimeOffset Expires)?> RefreshAsync(
        string refreshToken,
        InOutUser user,
        CancellationToken cancellationToken)
    {
        var existing = await tokens.FindByReferenceIdAsync(refreshToken, cancellationToken);
        if (existing is null)
        {
            return null;
        }

        var status = await tokens.GetStatusAsync(existing, cancellationToken);
        if (!string.Equals(status, Statuses.Valid, StringComparison.Ordinal))
        {
            return null;
        }

        var expires = await tokens.GetExpirationDateAsync(existing, cancellationToken);
        if (expires is not null && expires <= DateTimeOffset.UtcNow)
        {
            await tokens.TryRevokeAsync(existing, cancellationToken);
            return null;
        }

        var subject = await tokens.GetSubjectAsync(existing, cancellationToken);
        if (!string.Equals(subject, user.Id.ToString(), StringComparison.Ordinal))
        {
            return null;
        }

        if (!await tokens.TryRedeemAsync(existing, cancellationToken))
        {
            return null;
        }

        return await IssueAsync(user, cancellationToken);
    }

    public async Task<(string Access, string Refresh, DateTimeOffset Expires)?> IssueAsync(
        InOutUser user,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var principal = IdentityPrincipal.Create(
            user,
            [Scopes.OpenId, Scopes.Email, Scopes.Profile, Scopes.OfflineAccess]);
        var accessExpires = now.AddMinutes(10);
        var accessRef = NewReference();
        var refreshRef = NewReference();
        await tokens.CreateAsync(
            new OpenIddictTokenDescriptor
            {
                Principal = principal,
                Subject = user.Id.ToString(),
                Type = TokenTypeHints.AccessToken,
                Status = Statuses.Valid,
                Payload = NewPayload(),
                ReferenceId = accessRef,
                CreationDate = now,
                ExpirationDate = accessExpires
            },
            cancellationToken);
        await tokens.CreateAsync(
            new OpenIddictTokenDescriptor
            {
                Principal = principal,
                Subject = user.Id.ToString(),
                Type = TokenTypeHints.RefreshToken,
                Status = Statuses.Valid,
                Payload = NewPayload(),
                ReferenceId = refreshRef,
                CreationDate = now,
                ExpirationDate = now.AddDays(14)
            },
            cancellationToken);
        return (accessRef, refreshRef, accessExpires);
    }

    private static string NewReference() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

    private static string NewPayload() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
}
