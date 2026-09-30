using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace InOut.Api.Security;

public static class SupabaseAuthenticationExtensions
{
    public static IServiceCollection AddSupabaseAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var issuer = configuration[ApiContract.Configuration.SupabaseIssuer]?.TrimEnd('/')
            ?? throw new InvalidOperationException("Supabase:Jwt:Issuer is required.");
        var audience = configuration[ApiContract.Configuration.SupabaseAudience]
            ?? throw new InvalidOperationException("Supabase:Jwt:Audience is required.");

        var localSecret = configuration["Supabase:Jwt:LocalSecret"];
        var localMode = string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Development", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(localSecret);

        if (!Uri.TryCreate(issuer, UriKind.Absolute, out var issuerUri) ||
            (issuerUri.Scheme != Uri.UriSchemeHttps &&
             !(localMode && issuerUri.Scheme == Uri.UriSchemeHttp)))
        {
            throw new InvalidOperationException("Supabase:Jwt:Issuer must be an HTTPS URL.");
        }

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                if (localMode)
                {
                    options.TokenValidationParameters = CreateTokenValidationParameters(issuer, audience);
                    var keyBytes = Encoding.UTF8.GetBytes(localSecret!);
                    options.TokenValidationParameters.IssuerSigningKeyResolver = (_, _, kid, _) =>
                        [new SymmetricSecurityKey(keyBytes) { KeyId = kid }];
                    options.TokenValidationParameters.ValidAlgorithms = [SecurityAlgorithms.HmacSha256];
                }
                else
                {
                    options.Authority = issuer;
                    options.RequireHttpsMetadata = true;
                    options.TokenValidationParameters = CreateTokenValidationParameters(issuer, audience);
                }

                options.MapInboundClaims = false;
                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = context =>
                    {
                        Console.WriteLine($"[JwtBearer Error] Auth failed: {context.Exception}");
                        return Task.CompletedTask;
                    },
                    OnChallenge = context =>
                    {
                        Console.WriteLine($"[JwtBearer Challenge] Error: {context.Error}, Description: {context.ErrorDescription}");
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = context =>
                    {
                        if (!Guid.TryParse(
                            context.Principal?.FindFirst(ApiContract.Claims.Subject)?.Value,
                            out _))
                        {
                            context.Fail("A valid subject claim is required.");
                        }

                        return Task.CompletedTask;
                    }
                };
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
            ValidAlgorithms = [SecurityAlgorithms.EcdsaSha256, SecurityAlgorithms.RsaSha256, SecurityAlgorithms.HmacSha256]
        };
}
