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
        group.MapPost("/mfa/verify", MfaVerify);
        group.MapPost("/sessions", CreateSession);
        group.MapPost("/sessions/pending", CreatePendingSession);
        group.MapPost("/sessions/resolve", ResolveSession);
        group.MapPost("/sessions/mfa", CompleteMfaSession);
        group.MapPost("/sessions/rotate", RotateSession);
        group.MapPost("/sessions/revoke", RevokeSession);
        app.MapMethods("/connect/authorize", [HttpMethods.Get, HttpMethods.Post], Authorize)
            .RequireRateLimiting("identity");
        app.MapPost("/connect/token", Token).RequireRateLimiting("identity");
        app.MapMethods("/connect/userinfo", [HttpMethods.Get, HttpMethods.Post], UserInfo)
            .RequireRateLimiting("identity");
        app.MapGet("/connect/logout", () => Results.StatusCode(StatusCodes.Status405MethodNotAllowed))
            .RequireRateLimiting("identity");
        app.MapPost("/connect/logout", EndSession).RequireRateLimiting("identity");
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

        return Result(await accounts.StartMfaReenrollmentAsync(body.Ticket, body.Password, cancellationToken));
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

    private static async Task<IResult> MfaVerify(
        HttpContext http,
        IdentityCommand body,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        return Result(await accounts.VerifyMfaAsync(body.Ticket, body.Code, cancellationToken));
    }

    private static async Task<IResult> CreateSession(
        HttpContext http,
        SessionCommand body,
        BrowserSessionService sessions,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        var created = await sessions.CreateAuthenticatedAsync(
            body.AccessToken,
            body.RefreshToken,
            cancellationToken);
        return created is null ? Results.BadRequest() : SessionResult(created);
    }

    private static async Task<IResult> CreatePendingSession(
        HttpContext http,
        SessionCommand body,
        BrowserSessionService sessions,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        var created = await sessions.CreatePendingAsync(body.Ticket, body.Purpose, cancellationToken);
        return created is null ? Results.BadRequest() : SessionResult(created);
    }

    private static async Task<IResult> ResolveSession(
        HttpContext http,
        SessionCommand body,
        BrowserSessionService sessions,
        IdentityTokenIssuer issuer,
        UserManager<InOutUser> users,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        var current = await sessions.GetAsync(body.SessionId, cancellationToken);
        if (current is null)
        {
            return Results.Json(new { code = "session_missing" }, statusCode: StatusCodes.Status401Unauthorized);
        }

        if (current.Purpose == BrowserSessionService.AuthenticatedPurpose &&
            current.RefreshToken is not null &&
            current.AccessExpiresAt is not null &&
            current.AccessExpiresAt < TimeProvider.System.GetUtcNow().AddMinutes(1))
        {
            if (!await sessions.TryClaimRefreshAsync(body.SessionId, cancellationToken))
            {
                return SessionResult(current);
            }

            var user = await users.FindByIdAsync(current.User.Id.ToString());
            if (user is null)
            {
                await sessions.RevokeAsync(body.SessionId, cancellationToken);
                return Results.Json(new { code = "session_missing" }, statusCode: StatusCodes.Status401Unauthorized);
            }

            var minted = await issuer.RefreshAsync(current.RefreshToken, user, cancellationToken);
            if (minted is null)
            {
                await sessions.RevokeAsync(body.SessionId, cancellationToken);
                return Results.Json(new { code = "session_missing" }, statusCode: StatusCodes.Status401Unauthorized);
            }

            current = await sessions.CompleteRefreshAsync(
                body.SessionId,
                minted.Value.Access,
                minted.Value.Refresh,
                minted.Value.Expires,
                cancellationToken);
            if (current is null)
            {
                return Results.Json(new { code = "session_missing" }, statusCode: StatusCodes.Status401Unauthorized);
            }
        }

        return SessionResult(current);
    }

    private static async Task<IResult> CompleteMfaSession(
        HttpContext http,
        SessionCommand body,
        BrowserSessionService sessions,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        if (!await sessions.CsrfMatchesAsync(body.SessionId, body.Csrf, cancellationToken))
        {
            return Results.BadRequest();
        }

        var completed = await sessions.CompleteMfaAsync(
            body.SessionId,
            body.Code,
            body.Password,
            cancellationToken);
        return completed is null ? Results.BadRequest() : SessionResult(completed);
    }

    private static async Task<IResult> RotateSession(
        HttpContext http,
        SessionCommand body,
        BrowserSessionService sessions,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        if (!await sessions.CsrfMatchesAsync(body.SessionId, body.Csrf, cancellationToken))
        {
            return Results.BadRequest();
        }

        var rotated = await sessions.RotateAsync(body.SessionId, cancellationToken);
        return rotated is null ? Results.BadRequest() : SessionResult(rotated);
    }

    private static async Task<IResult> RevokeSession(
        HttpContext http,
        SessionCommand body,
        BrowserSessionService sessions,
        CancellationToken cancellationToken)
    {
        if (!AuthorizeClient(http))
        {
            return Results.Unauthorized();
        }

        if (!string.IsNullOrEmpty(body.Csrf) &&
            !await sessions.CsrfMatchesAsync(body.SessionId, body.Csrf, cancellationToken))
        {
            return Results.BadRequest();
        }

        await sessions.RevokeAsync(body.SessionId, cancellationToken);
        return Results.Json(new { code = "signed_out" });
    }

    private static async Task<IResult> EndSession(HttpContext http, SignInManager<InOutUser> signIn, IIdentityAccounts accounts)
    {
        if (!HttpMethods.IsPost(http.Request.Method))
        {
            return Results.StatusCode(StatusCodes.Status405MethodNotAllowed);
        }

        var logoutAll = http.Request.HasFormContentType &&
            string.Equals(
                (await http.Request.ReadFormAsync(http.RequestAborted))["logout_all"].ToString(),
                "1",
                StringComparison.Ordinal);
        var user = await signIn.UserManager.GetUserAsync(http.User);
        if (user is not null && logoutAll)
        {
            await accounts.RevokeSessionsAsync(user.Id, http.RequestAborted);
        }

        await signIn.SignOutAsync();
        var redirect = http.Request.Query["post_logout_redirect_uri"].ToString();
        if (string.IsNullOrEmpty(redirect))
        {
            redirect = http.Request.HasFormContentType
                ? (await http.Request.ReadFormAsync(http.RequestAborted))["post_logout_redirect_uri"].ToString()
                : "";
        }

        if (Uri.TryCreate(redirect, UriKind.Absolute, out var uri) &&
            uri.Scheme == "inout" &&
            uri.Host == "auth")
        {
            return Results.Redirect(uri.ToString());
        }

        return Results.Redirect("/account/login");
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
                return RejectToken();
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
            return RejectToken();
        }

        if (!string.Equals(request.ClientId, IdentityHosting.WebClientId, StringComparison.Ordinal))
        {
            return RejectToken();
        }

        var redeemed = await accounts.RedeemLoginTicketAsync(
            request.GetParameter("ticket")?.ToString() ?? "",
            http.RequestAborted);
        if (redeemed is null || redeemed.MfaReenrollmentRequired || !redeemed.EmailConfirmed)
        {
            return RejectToken();
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

    private static IResult RejectToken() =>
        Results.Forbid(
            properties: new AuthenticationProperties(new Dictionary<string, string?>
            {
                [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidGrant,
                [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = "The token request was rejected."
            }),
            authenticationSchemes: [OpenIddictServerAspNetCoreDefaults.AuthenticationScheme]);

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
                IdentityCodes.MfaReenrollmentRequired or
                IdentityCodes.MfaRequired or
                IdentityCodes.MfaRecoveryRequired => StatusCodes.Status403Forbidden,
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

    private static IResult SessionResult(BrowserSessionIssue session) =>
        Results.Json(new
        {
            sessionId = session.SessionId,
            csrf = session.Csrf,
            purpose = session.Purpose,
            user = session.User,
            expiresAt = session.ExpiresAt,
            accessToken = session.AccessToken,
            loginTicket = session.LoginTicket,
            pendingTicket = session.PendingTicket
        });
}

public sealed record IdentityCommand(
    string Email = "",
    string Password = "",
    string Name = "",
    string Code = "",
    string Ticket = "");

public sealed record SessionCommand(
    Guid? UserId = null,
    string AccessToken = "",
    string RefreshToken = "",
    string Ticket = "",
    string Purpose = "",
    string SessionId = "",
    string Code = "",
    string Csrf = "",
    string Password = "");
