using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using InOut.Api.Diagnostics;
using InOut.Application.Diagnostics;
using InOut.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace InOut.Api.Tests;

/// <summary>
/// Runs the real identity flows (in-memory SQLite) and records what would be sent to PostHog.
/// </summary>
public sealed class IdentityProductEventTests : IAsyncLifetime
{
    private const string ClientProbe = "/__test/product-client";
    private readonly string databaseName = "events-" + Guid.NewGuid().ToString("N");
    private readonly RecordingAnalytics analytics = new();
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
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IPostHogAnalytics>(analytics);
                services.AddSingleton<IStartupFilter, ClientProbeStartupFilter>();
            });
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
    public async Task WebConfirmationAndSignInAreRecordedOnceAndRefreshIsNot()
    {
        var userId = await RegisterAndConfirmAsync("web@example.com");

        var login = await client.PostAsJsonAsync("/api/v1/identity/login", new
        {
            email = "web@example.com",
            password = "password8"
        });
        var ticket = JsonDocument.Parse(await login.Content.ReadAsStringAsync())
            .RootElement.GetProperty("ticket").GetString()!;
        var tokens = await TokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "identity_ticket",
            ["client_id"] = "inout-web",
            ["client_secret"] = "dev-only-web-client-secret",
            ["ticket"] = ticket,
            ["scope"] = "openid email profile offline_access"
        });
        await TokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["client_id"] = "inout-web",
            ["client_secret"] = "dev-only-web-client-secret",
            ["refresh_token"] = tokens.Refresh
        });

        var events = await WaitForAsync(2);
        var confirmed = Assert.Single(events, e => e.Name == "account_confirmed");
        Assert.Equal(userId, confirmed.DistinctId);
        Assert.Equal("web", confirmed.Properties["client"]);
        var signedIn = Assert.Single(events, e => e.Name == "signed_in");
        Assert.Equal(userId, signedIn.DistinctId);
        Assert.Equal("web", signedIn.Properties["client"]);
        AssertNoPersonalData(events, "web@example.com");

        Assert.Equal("web", await ClientSeenByApiAsync(tokens.Access));
    }

    [Fact]
    public async Task MobileSignInIsRecordedAsMobileAndItsTokenIdentifiesTheClient()
    {
        var userId = await RegisterAndConfirmAsync("phone@example.com");

        using var browser = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var loginPage = await (await browser.GetAsync("/account/login?returnUrl=/connect/authorize"))
            .Content.ReadAsStringAsync();
        var antiforgery = Between(loginPage, "name=\"__RequestVerificationToken\" value=\"", "\"");
        await browser.PostAsync("/account/login", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["__RequestVerificationToken"] = WebUtility.HtmlDecode(antiforgery),
            ["email"] = "phone@example.com",
            ["password"] = "password8",
            ["returnUrl"] = "/connect/authorize"
        }));
        var verifier = Base64Url(RandomNumberGenerator.GetBytes(32));
        var challenge = Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var authorize = await browser.GetAsync(
            "/connect/authorize?client_id=inout-mobile&redirect_uri=inout://auth/callback&response_type=code&scope=openid%20email%20profile%20offline_access&code_challenge="
            + challenge + "&code_challenge_method=S256&state=s");
        var code = Uri.UnescapeDataString(new Uri(authorize.Headers.Location!.ToString()).Query.TrimStart('?')
            .Split('&').Select(part => part.Split('=', 2)).First(part => part[0] == "code")[1]);
        var tokens = await TokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["client_id"] = "inout-mobile",
            ["code"] = code,
            ["redirect_uri"] = "inout://auth/callback",
            ["code_verifier"] = verifier
        });

        var events = await WaitForAsync(2);
        var signedIn = Assert.Single(events, e => e.Name == "signed_in");
        Assert.Equal(userId, signedIn.DistinctId);
        Assert.Equal("mobile", signedIn.Properties["client"]);
        AssertNoPersonalData(events, "phone@example.com");

        Assert.Equal("mobile", await ClientSeenByApiAsync(tokens.Access));
    }

    private async Task<string> RegisterAndConfirmAsync(string email)
    {
        await client.PostAsJsonAsync("/api/v1/identity/register", new { email, password = "password8", name = "Person" });
        var confirm = await client.PostAsJsonAsync("/api/v1/identity/confirm", new { email, code = CodeFor(email) });
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        var events = await WaitForAsync(1);
        return Assert.Single(events, e => e.Name == "account_confirmed").DistinctId;
    }

    private async Task<string> ClientSeenByApiAsync(string accessToken)
    {
        using var api = factory.CreateClient();
        api.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return await api.GetStringAsync(ClientProbe);
    }

    private async Task<List<RecordedEvent>> WaitForAsync(int count)
    {
        for (var attempt = 0; attempt < 50 && analytics.Events.Count < count; attempt++)
        {
            await Task.Delay(100);
        }

        Assert.True(analytics.Events.Count >= count, $"Expected {count} events, got {analytics.Events.Count}.");
        return [.. analytics.Events];
    }

    private static void AssertNoPersonalData(IEnumerable<RecordedEvent> events, string email)
    {
        foreach (var recorded in events)
        {
            var json = JsonSerializer.Serialize(recorded.Properties);
            Assert.DoesNotContain(email, json, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("Person", json, StringComparison.Ordinal);
        }
    }

    private string CodeFor(string email)
    {
        using var scope = factory.Services.CreateScope();
        var mail = scope.ServiceProvider.GetRequiredService<CapturingIdentityMail>();
        var message = mail.Messages.Last(item => string.Equals(item.To, email, StringComparison.OrdinalIgnoreCase));
        return System.Text.RegularExpressions.Regex.Match(message.Text, @"\d{8}").Value;
    }

    private async Task<(string Access, string Refresh)> TokenAsync(Dictionary<string, string> form)
    {
        using var anonymous = factory.CreateClient();
        var response = await anonymous.PostAsync("/connect/token", new FormUrlEncodedContent(form));
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = JsonDocument.Parse(raw).RootElement;
        return (json.GetProperty("access_token").GetString()!, json.GetProperty("refresh_token").GetString()!);
    }

    private static string Between(string text, string start, string end)
    {
        var from = text.IndexOf(start, StringComparison.Ordinal) + start.Length;
        return text[from..text.IndexOf(end, from, StringComparison.Ordinal)];
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed record RecordedEvent(string DistinctId, string Name, IReadOnlyDictionary<string, object?> Properties);

    private sealed class RecordingAnalytics : IPostHogAnalytics
    {
        public ConcurrentQueue<RecordedEvent> Events { get; } = new();

        public Task CaptureAsync(
            string distinctId,
            string eventName,
            IReadOnlyDictionary<string, object?>? properties = null,
            CancellationToken cancellationToken = default)
        {
            Events.Enqueue(new RecordedEvent(distinctId, eventName, properties ?? new Dictionary<string, object?>()));
            return Task.CompletedTask;
        }

        public Task IdentifyAsync(
            string distinctId,
            IReadOnlyDictionary<string, object?>? properties = null,
            CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    /// <summary>Test-only endpoint answering which client the API resolves from a bearer token.</summary>
    private sealed class ClientProbeStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Map(ClientProbe, branch =>
            {
                branch.UseAuthentication();
                branch.Run(async context =>
                {
                    var result = await context.AuthenticateAsync();
                    await context.Response.WriteAsync(result.Succeeded
                        ? ProductEvents.ClientFrom(result.Principal!)
                        : "unauthenticated");
                });
            });
            next(app);
        };
    }
}
