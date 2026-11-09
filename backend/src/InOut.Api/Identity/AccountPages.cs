using InOut.Api.Diagnostics;
using System.Net;
using InOut.Application.Identity;
using InOut.Infrastructure.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;

namespace InOut.Api.Identity;

public static class AccountPages
{
    public static WebApplication MapAccountPages(this WebApplication app)
    {
        app.MapGet("/account/login", Show);
        app.MapPost("/account/login", Login);
        app.MapGet("/account/register", Show);
        app.MapPost("/account/register", Register);
        app.MapGet("/account/confirm", Show);
        app.MapPost("/account/confirm", Confirm);
        app.MapGet("/account/forgot", Show);
        app.MapPost("/account/forgot", Forgot);
        app.MapGet("/account/reset", Show);
        app.MapPost("/account/reset", Reset);
        app.MapGet("/account/mfa", Show);
        app.MapPost("/account/mfa", Mfa);
        return app;
    }

    private static IResult Show(HttpContext http, IAntiforgery antiforgery)
    {
        var path = http.Request.Path.Value ?? "/account/login";
        var query = http.Request.Query;
        var token = antiforgery.GetAndStoreTokens(http);
        var returnUrl = LocalReturn(query["returnUrl"]);
        var body = path switch
        {
            "/account/register" => Fields("Criar conta", path, token.RequestToken!, """
                <label>Nome<input name="name" maxlength="100" required></label>
                <label>E-mail<input name="email" type="email" required></label>
                <label>Senha<input name="password" type="password" minlength="8" required></label>
                """),
            "/account/confirm" => Fields("Confirmar e-mail", path, token.RequestToken!, $"""
                <label>E-mail<input name="email" type="email" value="{WebUtility.HtmlEncode(query["email"])}" required></label>
                <label>Código<input name="code" inputmode="numeric" required></label>
                """),
            "/account/forgot" => Fields("Esqueci a senha", path, token.RequestToken!, """
                <label>E-mail<input name="email" type="email" required></label>
                """),
            "/account/reset" => Fields("Nova senha", path, token.RequestToken!, $"""
                <label>E-mail<input name="email" type="email" value="{WebUtility.HtmlEncode(query["email"])}" required></label>
                <label>Código<input name="code" inputmode="numeric" required></label>
                <label>Nova senha<input name="password" type="password" minlength="8" required></label>
                """),
            "/account/mfa" => Fields("Verificação", path, token.RequestToken!, $"""
                <input type="hidden" name="ticket" value="{WebUtility.HtmlEncode(query["ticket"])}">
                <label>Código do autenticador<input name="code" inputmode="numeric" required></label>
                """),
            _ => Fields("Entrar", "/account/login", token.RequestToken!, $"""
                <input type="hidden" name="returnUrl" value="{WebUtility.HtmlEncode(returnUrl)}">
                <label>E-mail<input name="email" type="email" required></label>
                <label>Senha<input name="password" type="password" required></label>
                """)
        };
        return Results.Content(Page(body), "text/html; charset=utf-8");
    }

    private static async Task<IResult> Login(
        HttpContext http,
        IAntiforgery antiforgery,
        IIdentityAccounts accounts,
        SignInManager<InOutUser> signIn,
        CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(http);
        var form = await http.Request.ReadFormAsync(cancellationToken);
        var result = await accounts.LoginAsync(form["email"].ToString(), form["password"].ToString(), cancellationToken);
        if (result.Code == IdentityCodes.MfaReenrollmentRequired)
        {
            http.Response.Cookies.Append("inout_mfa", result.Ticket ?? "", new CookieOptions
            {
                HttpOnly = true,
                Secure = http.Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                MaxAge = TimeSpan.FromMinutes(15),
                Path = "/account"
            });
            return Results.Redirect("/account/mfa");
        }

        if (!result.Succeeded || result.User is null)
        {
            return Results.Redirect("/account/login?error=" + Uri.EscapeDataString(result.Code));
        }

        var user = await signIn.UserManager.FindByIdAsync(result.User.Id.ToString());
        if (user is null)
        {
            return Results.Redirect("/account/login?error=invalid_credentials");
        }

        await signIn.SignInAsync(user, isPersistent: false);
        return Results.LocalRedirect(LocalReturn(form["returnUrl"].ToString()));
    }

    private static async Task<IResult> Register(
        HttpContext http,
        IAntiforgery antiforgery,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(http);
        var form = await http.Request.ReadFormAsync(cancellationToken);
        await accounts.RegisterAsync(
            form["email"].ToString(),
            form["password"].ToString(),
            form["name"].ToString(),
            cancellationToken);
        return Results.Redirect("/account/confirm?email=" + Uri.EscapeDataString(form["email"].ToString()));
    }

    private static async Task<IResult> Confirm(
        HttpContext http,
        IAntiforgery antiforgery,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(http);
        var form = await http.Request.ReadFormAsync(cancellationToken);
        var result = await accounts.ConfirmEmailAsync(form["email"].ToString(), form["code"].ToString(), cancellationToken);
        // Hosted pages are reached from a browser; the calling app is not known here.
        ProductEvents.AccountConfirmed(http, result, "unknown");
        return Results.Redirect(result.Succeeded ? "/account/login" : "/account/confirm?error=invalid_token");
    }

    private static async Task<IResult> Forgot(
        HttpContext http,
        IAntiforgery antiforgery,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(http);
        var form = await http.Request.ReadFormAsync(cancellationToken);
        await accounts.RequestPasswordResetAsync(form["email"].ToString(), cancellationToken);
        return Results.Redirect("/account/reset?sent=1&email=" + Uri.EscapeDataString(form["email"].ToString()));
    }

    private static async Task<IResult> Reset(
        HttpContext http,
        IAntiforgery antiforgery,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(http);
        var form = await http.Request.ReadFormAsync(cancellationToken);
        var exchange = await accounts.ExchangeRecoveryCodeAsync(
            form["email"].ToString(),
            form["code"].ToString(),
            cancellationToken);
        if (!exchange.Succeeded || exchange.Ticket is null)
        {
            return Results.Redirect("/account/reset?error=invalid_token");
        }

        var reset = await accounts.ResetPasswordAsync(exchange.Ticket, form["password"].ToString(), cancellationToken);
        return Results.Redirect(reset.Succeeded ? "/account/login?reset=1" : "/account/reset?error=invalid_token");
    }

    private static async Task<IResult> Mfa(
        HttpContext http,
        IAntiforgery antiforgery,
        IIdentityAccounts accounts,
        SignInManager<InOutUser> signIn,
        CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(http);
        var form = await http.Request.ReadFormAsync(cancellationToken);
        var ticket = string.IsNullOrEmpty(form["ticket"])
            ? http.Request.Cookies["inout_mfa"] ?? ""
            : form["ticket"].ToString();
        var result = await accounts.ConfirmMfaReenrollmentAsync(ticket, form["code"].ToString(), cancellationToken);
        if (!result.Succeeded || result.User is null)
        {
            return Results.Redirect("/account/mfa?error=invalid_token&ticket=" + Uri.EscapeDataString(form["ticket"].ToString()));
        }

        var user = await signIn.UserManager.FindByIdAsync(result.User.Id.ToString());
        if (user is null)
        {
            return Results.Redirect("/account/login?error=invalid_credentials");
        }

        await signIn.SignInAsync(user, isPersistent: false);
        return Results.LocalRedirect(LocalReturn(form["returnUrl"].ToString()));
    }

    private static string LocalReturn(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Contains('\\', StringComparison.Ordinal))
        {
            return "/account/login";
        }

        var query = value.IndexOf('?', StringComparison.Ordinal);
        var path = query >= 0 ? value[..query] : value;
        if (path != "/connect/authorize" || path.Contains("//", StringComparison.Ordinal))
        {
            return "/account/login";
        }

        return value;
    }

    private static string Fields(string title, string action, string token, string fields) =>
        $"""
        <h1>{WebUtility.HtmlEncode(title)}</h1>
        <form method="post" action="{WebUtility.HtmlEncode(action)}">
          <input type="hidden" name="__RequestVerificationToken" value="{WebUtility.HtmlEncode(token)}">
          {fields}
          <button type="submit">Continuar</button>
        </form>
        """;

    private static string Page(string body) =>
        $$"""
        <!doctype html>
        <html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>InOut</title>
        <style>body{font-family:sans-serif;background:#fbf6e8;color:#243024;margin:2rem}form{display:grid;gap:.75rem;max-width:24rem}input,button{font:inherit;padding:.6rem}</style>
        </head><body>{{body}}</body></html>
        """;
}
