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
        if (existing is null || !await tokens.TryRedeemAsync(existing, cancellationToken))
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
        var access = await tokens.CreateAsync(
            new OpenIddictTokenDescriptor
            {
                Principal = principal,
                Subject = user.Id.ToString(),
                Type = TokenTypeHints.AccessToken,
                Status = Statuses.Valid,
                CreationDate = now,
                ExpirationDate = accessExpires
            },
            cancellationToken);
        var refresh = await tokens.CreateAsync(
            new OpenIddictTokenDescriptor
            {
                Principal = principal,
                Subject = user.Id.ToString(),
                Type = TokenTypeHints.RefreshToken,
                Status = Statuses.Valid,
                CreationDate = now,
                ExpirationDate = now.AddDays(14)
            },
            cancellationToken);
        var accessRef = await tokens.GetReferenceIdAsync(access, cancellationToken);
        var refreshRef = await tokens.GetReferenceIdAsync(refresh, cancellationToken);
        if (string.IsNullOrEmpty(accessRef) || string.IsNullOrEmpty(refreshRef))
        {
            return null;
        }

        return (accessRef, refreshRef, accessExpires);
    }
}
