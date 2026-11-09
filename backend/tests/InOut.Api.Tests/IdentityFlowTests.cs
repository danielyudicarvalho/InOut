using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using InOut.Api.Identity;
using InOut.Application.Identity;
using InOut.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace InOut.Api.Tests;

public sealed class LegacyPasswordVerifierTests
{
    [Fact]
    public void BcryptMatchRequestsRehashAndRejectsWrongPassword()
    {
        var hasher = new InOutPasswordHasher();
        var user = new InOutUser();
        var hash = BCrypt.Net.BCrypt.HashPassword("password8", workFactor: 4);
        Assert.StartsWith("$2a$", hash, StringComparison.Ordinal);
        Assert.Equal(
            PasswordVerificationResult.SuccessRehashNeeded,
            hasher.VerifyHashedPassword(user, hash, "password8"));
        Assert.Equal(
            PasswordVerificationResult.Failed,
            hasher.VerifyHashedPassword(user, hash, "password9"));
        var identity = hasher.HashPassword(user, "password8");
        Assert.Equal(
            PasswordVerificationResult.Success,
            hasher.VerifyHashedPassword(user, identity, "password8"));
    }

    [Fact]
    public void Accepts2bPrefixAndRefuses2yArgonAndFirebaseHashes()
    {
        var hash = BCrypt.Net.BCrypt.HashPassword("password8", workFactor: 4);
        Assert.Equal(
            LegacyPasswordStatus.Match,
            LegacyPasswordVerifier.Verify("$2b$" + hash[4..], "password8"));
        Assert.Equal(
            LegacyPasswordStatus.RequiresReset,
            LegacyPasswordVerifier.Verify("$2y$" + hash[4..], "password8"));
        Assert.Equal(
            LegacyPasswordStatus.RequiresReset,
            LegacyPasswordVerifier.Verify("$argon2id$v=19$m=1,t=1,p=1$aa$bb", "password8"));
        Assert.Equal(
            LegacyPasswordStatus.RequiresReset,
            LegacyPasswordVerifier.Verify("$fbscrypt$v=1,n=1,r=1,p=1$aa$bb", "password8"));
        Assert.Equal(
            LegacyPasswordStatus.Mismatch,
            LegacyPasswordVerifier.Verify("", "password8"));
    }

    [Fact]
    public void UsesUtf8BytesAndRejectsPasswordsLongerThan72Bytes()
    {
        var exact = new string('a', 72);
        var hash = BCrypt.Net.BCrypt.HashPassword(exact, workFactor: 4);
        Assert.Equal(LegacyPasswordStatus.Match, LegacyPasswordVerifier.Verify(hash, exact));
        Assert.Equal(LegacyPasswordStatus.Mismatch, LegacyPasswordVerifier.Verify(hash, exact + "b"));
        Assert.Equal(LegacyPasswordStatus.Mismatch, LegacyPasswordVerifier.Verify(hash, new string('a', 71)));

        var unicode = new string('é', 36);
        Assert.Equal(72, Encoding.UTF8.GetByteCount(unicode));
        var unicodeHash = BCrypt.Net.BCrypt.HashPassword(unicode, workFactor: 4);
        Assert.Equal(LegacyPasswordStatus.Match, LegacyPasswordVerifier.Verify(unicodeHash, unicode));
        Assert.Equal(LegacyPasswordStatus.Mismatch, LegacyPasswordVerifier.Verify(unicodeHash, unicode + "a"));
        Assert.Equal(LegacyPasswordStatus.Mismatch, LegacyPasswordVerifier.Verify(unicodeHash, "e\u0301"));
    }
}

public sealed class IdentityImportPlannerTests
{
    [Fact]
    public void PreservesIdsAndRejectsCollisionsWithoutDroppingRows()
    {
        var now = DateTimeOffset.Parse("2026-11-08T00:00:00Z", CultureInfo.InvariantCulture);
        var first = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var second = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var accepted = LegacyIdentityImportPlanner.Plan(
        [
            User(second, "B@Example.com", "$2b$04$hashhashhashhashhashhashhashhashhashhashh", confirmed: true),
            User(first, "a@example.com", "$2a$04$hashhashhashhashhashhashhashhashhashhashh", banned: true)
        ], now);
        Assert.True(accepted.Accepted);
        Assert.Equal([first, second], accepted.Users.Select(user => user.Id).ToArray());
        Assert.Equal(2, accepted.Counts["accepted"]);
        Assert.Equal(2, accepted.Counts["bcrypt"]);
        Assert.Equal(1, accepted.Counts["banned"]);
        Assert.Equal("A@EXAMPLE.COM", accepted.Users[0].NormalizedEmail);

        var collision = LegacyIdentityImportPlanner.Plan(
        [
            User(first, "same@example.com", "$2a$04$hashhashhashhashhashhashhashhashhashhashh"),
            User(second, "SAME@example.com", "$2a$04$hashhashhashhashhashhashhashhashhashhashh")
        ], now);
        Assert.False(collision.Accepted);
        Assert.Equal("normalized_email_collision", collision.Code);
        Assert.Empty(collision.Users);

        var mfa = LegacyIdentityImportPlanner.Plan(
        [
            User(first, "mfa@example.com", "$2a$04$hashhashhashhashhashhashhashhashhashhashh", factors:
            [
                new ExportedFactor("factor", "verified", ContainsSecret: true)
            ], logins:
            [
                new ExportedLogin("google", "https://accounts.google.com", "subject-1")
            ])
        ], now);
        Assert.True(mfa.Accepted);
        Assert.True(mfa.Users[0].MfaReenrollmentRequired);
        Assert.Equal(1, mfa.Counts["mfa_reenroll"]);
        Assert.Equal(1, mfa.Counts["mfa_secrets_withheld"]);
        Assert.Equal(1, mfa.Counts["provider_links"]);

        var reset = LegacyIdentityImportPlanner.Plan(
        [
            User(first, "argon@example.com", "$argon2id$stored")
        ], now);
        Assert.Equal(PlannedPasswordKind.RequiresReset, Assert.Single(reset.Users).PasswordKind);
        Assert.Equal("$argon2id$stored", Assert.Single(reset.Users).PasswordHash);
    }

    private static ExportedIdentityUser User(
        Guid id,
        string email,
        string? hash,
        bool confirmed = false,
        bool banned = false,
        IReadOnlyList<ExportedFactor>? factors = null,
        IReadOnlyList<ExportedLogin>? logins = null) =>
        new(
            id,
            email,
            hash,
            confirmed ? DateTimeOffset.Parse("2026-01-01T00:00:00Z", CultureInfo.InvariantCulture) : null,
            banned ? DateTimeOffset.Parse("2099-01-01T00:00:00Z", CultureInfo.InvariantCulture) : null,
            "Ada",
            banned,
            logins ?? [],
            factors ?? []);
}

public sealed class IdentityFlowTests : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly string databaseName = "identity-" + Guid.NewGuid().ToString("N");
    private WebApplicationFactory<Program> factory = null!;
    private HttpClient client = null!;

    public Task InitializeAsync()
    {
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Database:Provider", "sqlite");
            builder.UseSetting("ConnectionStrings:Identity", $"Data Source=file:{databaseName}?mode=memory&cache=shared");
            builder.UseSetting(
                "ConnectionStrings:InOut",
                "Host=127.0.0.1;Port=1;Database=inout;Username=inout_api_runtime;Password=test;Timeout=1");
            builder.UseSetting("Auth:Issuer", "http://localhost:8080/");
            builder.UseSetting("Auth:PublicOrigin", "http://localhost:8080");
            builder.UseSetting("Auth:WebClientSecret", "dev-only-web-client-secret");
            builder.UseSetting("Auth:Email:Delivery", "capture");
            builder.UseSetting("Auth:DisableTransportSecurityRequirement", "true");
        });
        client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes("inout-web:dev-only-web-client-secret")));
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        client.Dispose();
        factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task RegisterConfirmLoginRefreshRevokeAndResetRejectReplay()
    {
        var register = await client.PostAsJsonAsync("/api/v1/identity/register", new
        {
            email = "Person@Example.com",
            password = "password8",
            name = "Person"
        });
        Assert.Equal(HttpStatusCode.OK, register.StatusCode);
        var code = CodeFor("Person@Example.com");
        var confirm = await client.PostAsJsonAsync("/api/v1/identity/confirm", new
        {
            email = "person@example.com",
            code
        });
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        var replay = await client.PostAsJsonAsync("/api/v1/identity/confirm", new
        {
            email = "person@example.com",
            code
        });
        Assert.Equal(HttpStatusCode.BadRequest, replay.StatusCode);

        var login = await ReadAsync(await client.PostAsJsonAsync("/api/v1/identity/login", new
        {
            email = "person@example.com",
            password = "password8"
        }));
        Assert.Equal("signed_in", login.Code);
        Assert.False(string.IsNullOrEmpty(login.Ticket));
        var tokens = await TokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "identity_ticket",
            ["client_id"] = "inout-web",
            ["client_secret"] = "dev-only-web-client-secret",
            ["ticket"] = login.Ticket!,
            ["scope"] = "openid email profile offline_access"
        });
        var again = await client.PostAsync("/connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "identity_ticket",
            ["client_id"] = "inout-web",
            ["client_secret"] = "dev-only-web-client-secret",
            ["ticket"] = login.Ticket!
        }));
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);

        using var userInfo = factory.CreateClient();
        userInfo.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await userInfo.GetAsync("/connect/userinfo")).StatusCode);
        userInfo.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-token");
        Assert.Equal(HttpStatusCode.Unauthorized, (await userInfo.GetAsync("/connect/userinfo")).StatusCode);
        userInfo.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Byb2plY3Quc3VwYWJhc2UuY28vYXV0aC92MSIsInN1YiI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSJ9.signature");
        Assert.Equal(HttpStatusCode.Unauthorized, (await userInfo.GetAsync("/connect/userinfo")).StatusCode);

        var refreshed = await TokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["client_id"] = "inout-web",
            ["client_secret"] = "dev-only-web-client-secret",
            ["refresh_token"] = tokens.RefreshToken
        });
        var reused = await client.PostAsync("/connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["client_id"] = "inout-web",
            ["client_secret"] = "dev-only-web-client-secret",
            ["refresh_token"] = tokens.RefreshToken
        }));
        Assert.Equal(HttpStatusCode.BadRequest, reused.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/v1/identity/forgot", new
        {
            email = "missing@example.com"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/v1/identity/forgot", new
        {
            email = "person@example.com"
        })).StatusCode);
        var resetCode = CodeFor("person@example.com");
        var recovery = await ReadAsync(await client.PostAsJsonAsync("/api/v1/identity/recovery/exchange", new
        {
            email = "person@example.com",
            code = resetCode
        }));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/identity/recovery/exchange", new
        {
            email = "person@example.com",
            code = resetCode
        })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/v1/identity/reset", new
        {
            ticket = recovery.Ticket,
            password = "password9"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/identity/reset", new
        {
            ticket = recovery.Ticket,
            password = "password9"
        })).StatusCode);
        var revoked = await client.PostAsync("/connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["client_id"] = "inout-web",
            ["client_secret"] = "dev-only-web-client-secret",
            ["refresh_token"] = refreshed.RefreshToken
        }));
        Assert.Equal(HttpStatusCode.BadRequest, revoked.StatusCode);
        var relogin = await ReadAsync(await client.PostAsJsonAsync("/api/v1/identity/login", new
        {
            email = "person@example.com",
            password = "password9"
        }));
        Assert.Equal("signed_in", relogin.Code);
    }

    [Fact]
    public async Task LegacyBcryptRehashesAndMfaBlocksPasswordOnlyTokens()
    {
        var hash = BCrypt.Net.BCrypt.HashPassword("password8", workFactor: 4);
        var id = Guid.NewGuid();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var importer = scope.ServiceProvider.GetRequiredService<IdentityImporter>();
            var plan = await importer.ImportAsync(
            [
                new ExportedIdentityUser(
                    id,
                    "legacy@example.com",
                    hash,
                    DateTimeOffset.UtcNow,
                    null,
                    "Legacy",
                    false,
                    [],
                    [])
            ],
            IdentityImporter.SourceHash("legacy-" + id),
            CancellationToken.None);
            Assert.True(plan.Accepted);
            var repeated = await importer.ImportAsync(
            [
                new ExportedIdentityUser(id, "legacy@example.com", hash, DateTimeOffset.UtcNow, null, "Legacy", false, [], [])
            ],
            IdentityImporter.SourceHash("legacy-" + id),
            CancellationToken.None);
            Assert.Equal(plan.Counts["accepted"], repeated.Counts["accepted"]);
        }

        var login = await ReadAsync(await client.PostAsJsonAsync("/api/v1/identity/login", new
        {
            email = "legacy@example.com",
            password = "password8"
        }));
        Assert.Equal("signed_in", login.Code);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<InOutUser>>();
            var user = await users.FindByIdAsync(id.ToString());
            Assert.StartsWith("AQAAAA", user!.PasswordHash, StringComparison.Ordinal);
        }

        var mfaId = Guid.NewGuid();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var importer = scope.ServiceProvider.GetRequiredService<IdentityImporter>();
            await importer.ImportAsync(
            [
                new ExportedIdentityUser(
                    mfaId,
                    "mfa@example.com",
                    BCrypt.Net.BCrypt.HashPassword("password8", workFactor: 4),
                    DateTimeOffset.UtcNow,
                    null,
                    "Mfa",
                    false,
                    [],
                    [new ExportedFactor("f1", "verified", true)])
            ],
            IdentityImporter.SourceHash("mfa-" + mfaId),
            CancellationToken.None);
        }

        var blocked = await client.PostAsJsonAsync("/api/v1/identity/login", new
        {
            email = "mfa@example.com",
            password = "password8"
        });
        var body = await blocked.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Contains("mfa_reenrollment_required", body, StringComparison.Ordinal);
        Assert.DoesNotContain("access_token", body, StringComparison.Ordinal);
        var mfa = JsonSerializer.Deserialize<CommandBody>(body, JsonOptions)
            ?? throw new InvalidOperationException(body);
        var startedResponse = await client.PostAsJsonAsync("/api/v1/identity/mfa/start", new { ticket = mfa.Ticket });
        var startedBody = await startedResponse.Content.ReadAsStringAsync();
        var started = JsonSerializer.Deserialize<CommandBody>(startedBody, JsonOptions)
            ?? throw new InvalidOperationException(startedBody);
        Assert.False(string.IsNullOrWhiteSpace(started.AuthenticatorKey), startedBody);
        var totp = Totp.Create(started.AuthenticatorKey!);
        var confirmed = await ReadAsync(await client.PostAsJsonAsync("/api/v1/identity/mfa/confirm", new
        {
            ticket = mfa.Ticket,
            code = totp
        }));
        Assert.Equal("signed_in", confirmed.Code);
        var tokens = await TokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "identity_ticket",
            ["client_id"] = "inout-web",
            ["client_secret"] = "dev-only-web-client-secret",
            ["ticket"] = confirmed.Ticket!,
            ["scope"] = "openid offline_access"
        });
        Assert.False(string.IsNullOrEmpty(tokens.AccessToken));
    }

    [Fact]
    public async Task SyntheticFixtureImportsOnceAndReplaysWithoutARemoteExport()
    {
        Assert.Throws<InvalidOperationException>(() => IdentityImportGate.Require(null, false));
        Assert.Throws<InvalidOperationException>(() => IdentityImportGate.Require("live", false));
        Assert.Throws<InvalidOperationException>(() => IdentityImportGate.Require(
            IdentityImportGate.Rehearsal,
            true));
        IdentityImportGate.Require(IdentityImportGate.Rehearsal, false);
        IdentityImportGate.Require(IdentityImportGate.ApprovedCutover, true);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            IdentityImportCommand.ReadLocalAsync("https://example.invalid/export.json", CancellationToken.None));

        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "synthetic-identity.json");
        var bytes = await IdentityImportCommand.ReadLocalAsync(path, CancellationToken.None);
        var rows = IdentityImportCommand.Parse(bytes);
        var plan = LegacyIdentityImportPlanner.Plan(rows, DateTimeOffset.Parse(
            "2026-11-08T00:00:00Z",
            CultureInfo.InvariantCulture));
        Assert.True(plan.Accepted);
        Assert.Equal(3, plan.Counts["accepted"]);
        Assert.Equal(3, plan.Counts["input"]);
        Assert.Equal(2, plan.Counts["email_confirmed"]);
        Assert.Equal(1, plan.Counts["unconfirmed"]);
        Assert.Equal(1, plan.Counts["banned"]);
        Assert.Equal(1, plan.Counts["bcrypt"]);
        Assert.Equal(1, plan.Counts["password_missing"]);
        Assert.Equal(1, plan.Counts["password_reset_required"]);
        Assert.Equal(1, plan.Counts["mfa_reenroll"]);
        Assert.Equal(1, plan.Counts["mfa_secrets_withheld"]);
        Assert.Equal(2, plan.Counts["provider_links"]);
        Assert.Equal("ADA@EXAMPLE.COM", plan.Users[0].NormalizedEmail);
        Assert.Equal(PlannedPasswordKind.RequiresReset, plan.Users[2].PasswordKind);
        Assert.True(plan.Users[2].MfaReenrollmentRequired);
        Assert.Equal("$argon2id$v=19$stored-not-verified", plan.Users[2].PasswordHash);

        var source = IdentityImporter.SourceHash(Encoding.UTF8.GetString(bytes));
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var importer = scope.ServiceProvider.GetRequiredService<IdentityImporter>();
            var imported = await importer.ImportAsync(rows, source, CancellationToken.None);
            var replayed = await importer.ImportAsync(rows, source, CancellationToken.None);
            Assert.True(imported.Accepted);
            Assert.Equal(imported.Counts["accepted"], replayed.Counts["accepted"]);
        }

        var login = await ReadAsync(await client.PostAsJsonAsync("/api/v1/identity/login", new
        {
            email = "ada@example.com",
            password = "password8"
        }));
        Assert.Equal("signed_in", login.Code);
        var blocked = await client.PostAsJsonAsync("/api/v1/identity/login", new
        {
            email = "banned@example.com",
            password = "password8"
        });
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        var body = await blocked.Content.ReadAsStringAsync();
        Assert.Contains("account_unavailable", body, StringComparison.Ordinal);
        Assert.DoesNotContain("access_token", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MobileAuthorizationCodeRequiresPkceAndRejectsClientSecret()
    {
        await client.PostAsJsonAsync("/api/v1/identity/register", new
        {
            email = "mobile@example.com",
            password = "password8",
            name = "Mobile"
        });
        await client.PostAsJsonAsync("/api/v1/identity/confirm", new
        {
            email = "mobile@example.com",
            code = CodeFor("mobile@example.com")
        });
        using var browser = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var loginPage = await browser.GetAsync("/account/login?returnUrl=/connect/authorize");
        var html = await loginPage.Content.ReadAsStringAsync();
        var token = Between(html, "name=\"__RequestVerificationToken\" value=\"", "\"");
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["__RequestVerificationToken"] = WebUtility.HtmlDecode(token),
            ["email"] = "mobile@example.com",
            ["password"] = "password8",
            ["returnUrl"] = "/connect/authorize"
        });
        var posted = await browser.PostAsync("/account/login", form);
        Assert.Equal(HttpStatusCode.Redirect, posted.StatusCode);
        var verifier = Base64Url(RandomNumberGenerator.GetBytes(32));
        var challenge = Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var authorize = await browser.GetAsync(
            "/connect/authorize?client_id=inout-mobile&redirect_uri=inout://auth/callback&response_type=code&scope=openid%20email%20profile%20offline_access&code_challenge="
            + challenge + "&code_challenge_method=S256&state=state-1");
        Assert.Equal(HttpStatusCode.Redirect, authorize.StatusCode);
        var location = authorize.Headers.Location?.ToString() ?? "";
        Assert.StartsWith("inout://auth/callback", location, StringComparison.Ordinal);
        var code = Uri.UnescapeDataString(new Uri(location).Query.TrimStart('?')
            .Split('&')
            .Select(part => part.Split('=', 2))
            .First(part => part[0] == "code")[1]);
        Assert.False(string.IsNullOrEmpty(code));
        using var native = factory.CreateClient();
        var withoutVerifier = await native.PostAsync("/connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["client_id"] = "inout-mobile",
            ["code"] = code!,
            ["redirect_uri"] = "inout://auth/callback"
        }));
        Assert.Equal(HttpStatusCode.BadRequest, withoutVerifier.StatusCode);
        var tokens = await TokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["client_id"] = "inout-mobile",
            ["code"] = code!,
            ["redirect_uri"] = "inout://auth/callback",
            ["code_verifier"] = verifier
        });
        Assert.False(string.IsNullOrEmpty(tokens.AccessToken));
        Assert.DoesNotContain("client_secret", tokens.Raw, StringComparison.Ordinal);
    }

    private string CodeFor(string email)
    {
        using var scope = factory.Services.CreateScope();
        var mail = scope.ServiceProvider.GetRequiredService<CapturingIdentityMail>();
        var message = mail.Messages.Last(item =>
            string.Equals(item.To, email, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.To, email.ToLowerInvariant(), StringComparison.Ordinal));
        return System.Text.RegularExpressions.Regex.Match(message.Text, @"\d{8}").Value;
    }

    private async Task<TokenBody> TokenAsync(Dictionary<string, string> form)
    {
        using var anonymous = factory.CreateClient();
        var response = await anonymous.PostAsync("/connect/token", new FormUrlEncodedContent(form));
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = JsonDocument.Parse(raw).RootElement;
        return new TokenBody(
            json.GetProperty("access_token").GetString()!,
            json.GetProperty("refresh_token").GetString()!,
            raw);
    }

    private static async Task<CommandBody> ReadAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<CommandBody>(body, JsonOptions)
            ?? throw new InvalidOperationException(body);
    }

    private static string Between(string text, string start, string end)
    {
        var from = text.IndexOf(start, StringComparison.Ordinal);
        Assert.True(from >= 0);
        from += start.Length;
        var to = text.IndexOf(end, from, StringComparison.Ordinal);
        return text[from..to];
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed record CommandBody(
        string Code,
        bool Succeeded,
        string? Ticket,
        string? AuthenticatorKey);

    private sealed record TokenBody(string AccessToken, string RefreshToken, string Raw);
}

internal static class Totp
{
    public static string Create(string base32)
    {
        var key = Decode(base32);
        var step = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        var counter = BitConverter.GetBytes(step);
        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(counter);
        }

#pragma warning disable CA5350 // RFC 6238 TOTP uses HMAC-SHA1, which is the Identity authenticator default.
        var hash = HMACSHA1.HashData(key, counter);
#pragma warning restore CA5350
        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24) |
                     (hash[offset + 1] << 16) |
                     (hash[offset + 2] << 8) |
                     hash[offset + 3];
        return (binary % 1_000_000).ToString("D6", CultureInfo.InvariantCulture);
    }

    private static byte[] Decode(string value)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var bits = "";
        foreach (var character in value.TrimEnd('=').ToUpperInvariant())
        {
            bits += Convert.ToString(alphabet.IndexOf(character), 2).PadLeft(5, '0');
        }

        var bytes = new byte[bits.Length / 8];
        for (var index = 0; index < bytes.Length; index++)
        {
            bytes[index] = Convert.ToByte(bits.Substring(index * 8, 8), 2);
        }

        return bytes;
    }
}
