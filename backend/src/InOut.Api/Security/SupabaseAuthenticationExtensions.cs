using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace InOut.Api.Security;

public static class SupabaseAuthenticationExtensions
{
    public static IServiceCollection AddSupabaseAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var issuer = configuration["Supabase:Jwt:Issuer"]?.TrimEnd('/')
            ?? throw new InvalidOperationException("Supabase:Jwt:Issuer is required.");
        var audience = configuration["Supabase:Jwt:Audience"]
            ?? throw new InvalidOperationException("Supabase:Jwt:Audience is required.");

        if (!Uri.TryCreate(issuer, UriKind.Absolute, out var issuerUri) ||
            issuerUri.Scheme != Uri.UriSchemeHttps)
        {
            throw new InvalidOperationException("Supabase:Jwt:Issuer must be an HTTPS URL.");
        }

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MetadataAddress = $"{issuer}/.well-known/jwks.json";
                options.RequireHttpsMetadata = true;
                options.MapInboundClaims = false;
                options.TokenValidationParameters = CreateTokenValidationParameters(issuer, audience);
            });

        return services;
    }

    public static TokenValidationParameters CreateTokenValidationParameters(
        string issuer,
        string audience) => new()
        {
            ValidateIssuerSigningKey = true,
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            ValidAlgorithms = [SecurityAlgorithms.EcdsaSha256, SecurityAlgorithms.RsaSha256]
        };
}
