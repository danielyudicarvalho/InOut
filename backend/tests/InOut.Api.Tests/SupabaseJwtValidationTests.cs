using System.Security.Cryptography;
using InOut.Api.Security;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace InOut.Api.Tests;

public sealed class SupabaseJwtValidationTests
{
    private const string Issuer = "https://project.supabase.co/auth/v1";
    private const string Audience = "authenticated";

    [Fact]
    public async Task RejectsTokenSignedByAnotherKey()
    {
        using var trustedKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        using var attackerKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var token = CreateToken(attackerKey, Issuer, Audience, DateTime.UtcNow.AddMinutes(5));

        var result = await ValidateAsync(token, trustedKey);

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("https://other.supabase.co/auth/v1", Audience, 5)]
    [InlineData(Issuer, "other-audience", 5)]
    [InlineData(Issuer, Audience, -5)]
    public async Task RejectsInvalidIssuerAudienceOrExpiration(
        string issuer,
        string audience,
        int expiresInMinutes)
    {
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var token = CreateToken(key, issuer, audience, DateTime.UtcNow.AddMinutes(expiresInMinutes));

        var result = await ValidateAsync(token, key);

        Assert.False(result.IsValid);
    }

    private static Task<TokenValidationResult> ValidateAsync(string token, ECDsa trustedKey)
    {
        var parameters = SupabaseAuthenticationExtensions
            .CreateTokenValidationParameters(Issuer, Audience);
        parameters.IssuerSigningKey = new ECDsaSecurityKey(trustedKey);
        return new JsonWebTokenHandler().ValidateTokenAsync(token, parameters);
    }

    private static string CreateToken(
        ECDsa key,
        string issuer,
        string audience,
        DateTime expires)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            Expires = expires,
            SigningCredentials = new SigningCredentials(
                new ECDsaSecurityKey(key),
                SecurityAlgorithms.EcdsaSha256)
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}
