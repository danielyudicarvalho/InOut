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
        var group = app.MapGroup("/account").RequireRateLimiting("identity");
        group.MapGet("/login", Show);
        group.MapPost("/login", Login);
        group.MapGet("/register", Show);
        group.MapPost("/register", Register);
        group.MapGet("/confirm", Show);
        group.MapPost("/confirm", Confirm);
        group.MapGet("/forgot", Show);
        group.MapPost("/forgot", Forgot);
        group.MapGet("/reset", Show);
        group.MapPost("/reset", Reset);
        group.MapGet("/mfa", Show);
        group.MapPost("/mfa", Mfa);
        group.MapGet("/logout", ShowLogout);
        group.MapPost("/logout", Logout);
        return app;
    }

    private static async Task<IResult> Show(
        HttpContext http,
        IAntiforgery antiforgery,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        var path = http.Request.Path.Value ?? "/account/login";
        var query = http.Request.Query;
        var token = antiforgery.GetAndStoreTokens(http);
        var returnUrl = LocalReturn(query["returnUrl"]);
        string mfaFields;
        if (path == "/account/mfa" && !string.IsNullOrEmpty(http.Request.Cookies["inout_mfa_enroll"]))
        {
            var started = await accounts.StartMfaReenrollmentAsync(
                http.Request.Cookies["inout_mfa_enroll"]!,
                cancellationToken);
            var secret = WebUtility.HtmlEncode(started.AuthenticatorKey ?? "");
            mfaFields = $"""
                <p>Cadastre este autenticador novo. O fator importado não é revelado.</p>
                <p><code>{secret}</code></p>
                <input type="hidden" name="returnUrl" value="{WebUtility.HtmlEncode(returnUrl)}">
                <label>Código do autenticador<input name="code" inputmode="numeric" required autocomplete="one-time-code"></label>
                """;
        }
        else
        {
            mfaFields = $"""
                <input type="hidden" name="returnUrl" value="{WebUtility.HtmlEncode(returnUrl)}">
                <label>Código do autenticador<input name="code" inputmode="numeric" required autocomplete="one-time-code"></label>
                """;
        }

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
                <p>A reposição do autenticador exige este e-mail. A senha sozinha não substitui um fator importado.</p>
                <label>E-mail<input name="email" type="email" required></label>
                """),
            "/account/reset" => Fields("Nova senha", path, token.RequestToken!, $"""
                <label>E-mail<input name="email" type="email" value="{WebUtility.HtmlEncode(query["email"])}" required></label>
                <label>Código<input name="code" inputmode="numeric" required></label>
                <label>Nova senha<input name="password" type="password" minlength="8" required></label>
                """),
            "/account/mfa" => Fields("Verificação", path, token.RequestToken!, mfaFields),
            _ => Fields("Entrar", "/account/login", token.RequestToken!, $"""
                <input type="hidden" name="returnUrl" value="{WebUtility.HtmlEncode(returnUrl)}">
                <label>E-mail<input name="email" type="email" required></label>
                <label>Senha<input name="password" type="password" required></label>
                """)
        };
        return Results.Content(Page(body), "text/html; charset=utf-8");
    }

    private static IResult ShowLogout(HttpContext http, IAntiforgery antiforgery)
    {
        var token = antiforgery.GetAndStoreTokens(http);
        var postLogout = LocalPostLogout(http.Request.Query["post_logout_redirect_uri"]);
        var body = Fields("Sair", "/account/logout", token.RequestToken!, $"""
            <input type="hidden" name="post_logout_redirect_uri" value="{WebUtility.HtmlEncode(postLogout)}">
            <p>Encerrar a sessão neste dispositivo e no servidor de contas.</p>
            """);
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
        var returnUrl = LocalReturn(form["returnUrl"].ToString());
        var result = await accounts.LoginAsync(form["email"].ToString(), form["password"].ToString(), cancellationToken);
        if (result.Code == IdentityCodes.MfaRecoveryRequired)
        {
            return Results.Redirect("/account/forgot?mfa=1");
        }

        if (result.Code == IdentityCodes.MfaRequired)
        {
            http.Response.Cookies.Append("inout_mfa", result.Ticket ?? "", new CookieOptions
            {
                HttpOnly = true,
                Secure = http.Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                MaxAge = TimeSpan.FromMinutes(15),
                Path = "/account"
            });
            return Results.Redirect("/account/mfa?returnUrl=" + Uri.EscapeDataString(returnUrl));
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
        return Results.LocalRedirect(returnUrl);
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

        if (exchange.Code == IdentityCodes.MfaReenrollmentRequired)
        {
            http.Response.Cookies.Append("inout_mfa_enroll", exchange.Ticket, new CookieOptions
            {
                HttpOnly = true,
                Secure = http.Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                MaxAge = TimeSpan.FromMinutes(15),
                Path = "/account"
            });
            return Results.Redirect("/account/mfa?enroll=1");
        }

        var reset = await accounts.ResetPasswordAsync(exchange.Ticket, form["password"].ToString(), cancellationToken);
        if (reset.Code == IdentityCodes.MfaReenrollmentRequired && reset.Ticket is not null)
        {
            http.Response.Cookies.Append("inout_mfa_enroll", reset.Ticket, new CookieOptions
            {
                HttpOnly = true,
                Secure = http.Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                MaxAge = TimeSpan.FromMinutes(15),
                Path = "/account"
            });
            return Results.Redirect("/account/mfa?enroll=1");
        }

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
        var returnUrl = LocalReturn(form["returnUrl"].ToString());
        var enroll = !string.IsNullOrEmpty(http.Request.Cookies["inout_mfa_enroll"]);
        var ticket = enroll
            ? http.Request.Cookies["inout_mfa_enroll"] ?? ""
            : http.Request.Cookies["inout_mfa"] ?? "";
        var result = enroll
            ? await accounts.ConfirmMfaReenrollmentAsync(ticket, form["code"].ToString(), cancellationToken)
            : await accounts.VerifyMfaAsync(ticket, form["code"].ToString(), cancellationToken);
        if (!result.Succeeded || result.User is null)
        {
            return Results.Redirect("/account/mfa?error=invalid_token&returnUrl=" + Uri.EscapeDataString(returnUrl));
        }

        var user = await signIn.UserManager.FindByIdAsync(result.User.Id.ToString());
        if (user is null)
        {
            return Results.Redirect("/account/login?error=invalid_credentials");
        }

        await signIn.SignInAsync(user, isPersistent: false);
        http.Response.Cookies.Delete("inout_mfa", new CookieOptions { Path = "/account" });
        http.Response.Cookies.Delete("inout_mfa_enroll", new CookieOptions { Path = "/account" });
        return Results.LocalRedirect(returnUrl);
    }

    private static async Task<IResult> Logout(
        HttpContext http,
        IAntiforgery antiforgery,
        SignInManager<InOutUser> signIn,
        IIdentityAccounts accounts,
        CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(http);
        var form = await http.Request.ReadFormAsync(cancellationToken);
        var user = await signIn.UserManager.GetUserAsync(http.User);
        if (user is not null)
        {
            await accounts.RevokeSessionsAsync(user.Id, cancellationToken);
        }

        await signIn.SignOutAsync();
        var redirect = LocalPostLogout(form["post_logout_redirect_uri"]);
        return string.IsNullOrEmpty(redirect)
            ? Results.Redirect("/account/login")
            : Results.Redirect(redirect);
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

    private static string LocalPostLogout(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            !Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            !string.IsNullOrEmpty(uri.Fragment))
        {
            return "";
        }

        if (uri.Scheme == "inout" && uri.Host == "auth")
        {
            return uri.ToString();
        }

        return "";
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
