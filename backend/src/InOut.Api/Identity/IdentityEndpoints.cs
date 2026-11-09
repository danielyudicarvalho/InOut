using System.Security.Claims;
using System.Text;
using System.Text.Json;
using InOut.Application.Identity;
using InOut.Infrastructure.Identity;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using OpenIddict.Validation.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace InOut.Api.Identity;

public static class IdentityEndpoints
{
    public static WebApplication MapIdentityEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/identity").RequireRateLimiting("identity");
        group.MapPost("/register", Register);
        group.MapPost("/confirm", Confirm);
        group.MapPost("/resend", Resend);
        group.MapPost("/forgot", Forgot);
        group.MapPost("/recovery/exchange", Exchange);
        group.MapPost("/reset", Reset);
        group.MapPost("/login", Login);
        group.MapPost("/mfa/start", MfaStart);
        group.MapPost("/mfa/confirm", MfaConfirm);
        app.MapMethods("/connect/authorize", [HttpMethods.Get, HttpMethods.Post], Authorize);
        app.MapPost("/connect/token", Token);
        app.MapMethods("/connect/userinfo", [HttpMethods.Get, HttpMethods.Post], UserInfo);
        app.MapAccountPages();
        return app;
    }

    private static async Task<IResult> Register(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.RegisterAsync(body.Email, body.Password, body.Name, cancellationToken));
    }

    private static async Task<IResult> Confirm(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.ConfirmEmailAsync(body.Email, body.Code, cancellationToken));
    }

    private static async Task<IResult> Resend(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.ResendConfirmationAsync(body.Email, cancellationToken));
    }

    private static async Task<IResult> Forgot(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.RequestPasswordResetAsync(body.Email, cancellationToken));
    }

    private static async Task<IResult> Exchange(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.ExchangeRecoveryCodeAsync(body.Email, body.Code, cancellationToken));
    }

    private static async Task<IResult> Reset(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.ResetPasswordAsync(body.Ticket, body.Password, cancellationToken));
    }

    private static async Task<IResult> Login(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.LoginAsync(body.Email, body.Password, cancellationToken));
    }

    private static async Task<IResult> MfaStart(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.StartMfaReenrollmentAsync(body.Ticket, cancellationToken));
    }

    private static async Task<IResult> MfaConfirm(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.ConfirmMfaReenrollmentAsync(body.Ticket, body.Code, cancellationToken));
    }

    private static async Task<IResult> Authorize(HttpContext http, UserManager<InOutUser> users)
    {
        var request = http.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The authorization request is missing.");
        if (!string.Equals(request.ClientId, IdentityHosting.MobileClientId, StringComparison.Ordinal))
        {
            return Results.Forbid();
        }

        var cookie = await http.AuthenticateAsync(IdentityConstants.ApplicationScheme);
        if (!cookie.Succeeded || cookie.Principal is null)
        {
            return Results.Challenge(
                properties: null,
                authenticationSchemes: [IdentityConstants.ApplicationScheme]);
        }

        var user = await users.GetUserAsync(cookie.Principal);
        if (user is null || !user.EmailConfirmed || user.MfaReenrollmentRequired ||
            (user.BannedUntil is not null && user.BannedUntil > TimeProvider.System.GetUtcNow()))
        {
            return Results.Forbid();
        }

        var principal = IdentityPrincipal.Create(user, request.GetScopes());
        return Results.SignIn(principal, authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    private static async Task<IResult> Token(
        HttpContext http,
        IdentityAccountService accounts,
        UserManager<InOutUser> users)
    {
        var request = http.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The token request is missing.");
        if (request.IsAuthorizationCodeGrantType() || request.IsRefreshTokenGrantType())
        {
            var authenticate = await http.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
            var subject = authenticate.Principal?.GetClaim(Claims.Subject);
            var user = subject is null ? null : await users.FindByIdAsync(subject);
            var stamp = authenticate.Principal?.GetClaim(IdentityHosting.StampClaim);
            if (!authenticate.Succeeded || user is null || !user.EmailConfirmed ||
                user.MfaReenrollmentRequired ||
                !string.Equals(stamp, user.SecurityStamp, StringComparison.Ordinal) ||
                (user.BannedUntil is not null && user.BannedUntil > TimeProvider.System.GetUtcNow()))
            {
                return Results.Forbid();
            }

            var granted = request.GetScopes();
            if (!granted.Any() && authenticate.Principal is not null)
            {
                granted = authenticate.Principal.GetScopes();
            }

            var principal = IdentityPrincipal.Create(user, granted);
            return Results.SignIn(principal, authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }

        if (request.GrantType != IdentityHosting.TicketGrant)
        {
            return Results.Forbid();
        }

        if (!string.Equals(request.ClientId, IdentityHosting.WebClientId, StringComparison.Ordinal))
        {
            return Results.Forbid();
        }

        var redeemed = await accounts.RedeemLoginTicketAsync(
            request.GetParameter("ticket")?.ToString() ?? "",
            http.RequestAborted);
        if (redeemed is null || redeemed.MfaReenrollmentRequired || !redeemed.EmailConfirmed)
        {
            return Results.Forbid();
        }

        IEnumerable<string> scopes = request.GetScopes().Any()
            ? request.GetScopes()
            : [Scopes.OpenId, Scopes.Email, Scopes.Profile, Scopes.OfflineAccess];
        return Results.SignIn(
            IdentityPrincipal.Create(redeemed, scopes),
            authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    private static async Task<IResult> UserInfo(HttpContext http, UserManager<InOutUser> users)
    {
        var authenticate = await http.AuthenticateAsync(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);
        var subject = authenticate.Principal?.GetClaim(Claims.Subject);
        if (!authenticate.Succeeded || !Guid.TryParse(subject, out var userId))
        {
            return Results.Challenge(authenticationSchemes: [OpenIddictServerAspNetCoreDefaults.AuthenticationScheme]);
        }

        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Results.Challenge(authenticationSchemes: [OpenIddictServerAspNetCoreDefaults.AuthenticationScheme]);
        }

        return Results.Ok(new Dictionary<string, string?>
        {
            [Claims.Subject] = user.Id.ToString(),
            [Claims.Email] = user.Email,
            ["email_verified"] = user.EmailConfirmed ? "true" : "false"
        });
    }

    private static bool AuthorizeClient(HttpContext http)
    {
        var header = http.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        string decoded;
        try
        {
            decoded = Encoding.UTF8.GetString(Convert.FromBase64String(header["Basic ".Length..].Trim()));
        }
        catch (FormatException)
        {
            return false;
        }

        var split = decoded.Split(':', 2);
        if (split.Length != 2 ||
            !string.Equals(split[0], IdentityHosting.WebClientId, StringComparison.Ordinal))
        {
            return false;
        }

        var secret = IdentityHosting.WebClientSecret(http.RequestServices.GetRequiredService<IConfiguration>(),
            http.RequestServices.GetRequiredService<IWebHostEnvironment>());
        var left = Encoding.UTF8.GetBytes(split[1]);
        var right = Encoding.UTF8.GetBytes(secret);
        return left.Length == right.Length &&
               System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(left, right);
    }

    private static IResult Result(IdentityCommandResult result)
    {
        var status = result.Code switch
        {
            IdentityCodes.InvalidCredentials => StatusCodes.Status401Unauthorized,
            IdentityCodes.InvalidToken => StatusCodes.Status400BadRequest,
            IdentityCodes.WeakPassword => StatusCodes.Status400BadRequest,
            IdentityCodes.RateLimited => StatusCodes.Status429TooManyRequests,
            IdentityCodes.EmailNotConfirmed or
                IdentityCodes.AccountUnavailable or
                IdentityCodes.PasswordResetRequired or
                IdentityCodes.MfaReenrollmentRequired => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status200OK
        };
        return Results.Json(new
        {
            code = result.Code,
            succeeded = result.Succeeded,
            user = result.User,
            ticket = result.Ticket,
            authenticatorKey = result.AuthenticatorKey,
            otpAuthUri = result.OtpAuthUri
        }, statusCode: status);
    }
}

public sealed record IdentityCommand(
    string Email = "",
    string Password = "",
    string Name = "",
    string Code = "",
    string Ticket = "");
