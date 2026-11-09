using System.Net;
using System.Text.Json;
using InOut.Infrastructure.Diagnostics;
using Xunit;

namespace InOut.Api.Tests;

public sealed class PostHogAnalyticsTests
{
    [Fact]
    public async Task CaptureAsyncWhenApiKeyIsEmptyDoesNotSendRequest()
    {
        var handler = new TestMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)));
        var client = new HttpClient(handler);
        var analytics = new PostHogAnalytics(client, "", "https://us.i.posthog.com");

        await analytics.CaptureAsync("user-123", "test_event");

        Assert.Equal(0, handler.RequestCount);
    }

    [Fact]
    public async Task CaptureAsyncWhenApiKeyIsProvidedSendsValidJsonPayload()
    {
        HttpRequestMessage? capturedRequest = null;
        string? capturedBody = null;

        var handler = new TestMessageHandler(async (request, cancellationToken) =>
        {
            capturedRequest = request;
            capturedBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var client = new HttpClient(handler);
        var analytics = new PostHogAnalytics(client, "phc_test_key_123", "https://us.i.posthog.com");

        var properties = new Dictionary<string, object?>
        {
            ["amount_cents"] = 15000,
            ["kind"] = "expense"
        };

        await analytics.CaptureAsync("user-456", "transaction_created", properties);

        Assert.Equal(1, handler.RequestCount);
        Assert.NotNull(capturedRequest);
        Assert.Equal(HttpMethod.Post, capturedRequest!.Method);
        Assert.Equal("https://us.i.posthog.com/capture/", capturedRequest.RequestUri!.ToString());

        using var jsonDoc = JsonDocument.Parse(capturedBody!);
        var root = jsonDoc.RootElement;
        Assert.Equal("phc_test_key_123", root.GetProperty("api_key").GetString());
        Assert.Equal("transaction_created", root.GetProperty("event").GetString());
        Assert.Equal("user-456", root.GetProperty("distinct_id").GetString());
        Assert.Equal(15000, root.GetProperty("properties").GetProperty("amount_cents").GetInt64());
        Assert.Equal("expense", root.GetProperty("properties").GetProperty("kind").GetString());
    }

    [Fact]
    public async Task CaptureAsyncWhenHttpErrorOccursFailsOpenWithoutThrowing()
    {
        var handler = new TestMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError)));
        var client = new HttpClient(handler);
        var analytics = new PostHogAnalytics(client, "phc_test_key_123", "https://us.i.posthog.com");

        // Must not throw
        await analytics.CaptureAsync("user-789", "failing_event");
        Assert.Equal(1, handler.RequestCount);
    }

    [Fact]
    public async Task IdentifyAsyncSendsIdentifyEventWithSetProperties()
    {
        string? capturedBody = null;
        var handler = new TestMessageHandler(async (request, cancellationToken) =>
        {
            capturedBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var client = new HttpClient(handler);
        var analytics = new PostHogAnalytics(client, "phc_test_key_123", "https://us.i.posthog.com");

        await analytics.IdentifyAsync("user-user-1", new Dictionary<string, object?>
        {
            ["email"] = "user@test.com",
            ["role"] = "owner"
        });

        Assert.Equal(1, handler.RequestCount);
        using var jsonDoc = JsonDocument.Parse(capturedBody!);
        var root = jsonDoc.RootElement;
        Assert.Equal("$identify", root.GetProperty("event").GetString());
        Assert.Equal("user@test.com", root.GetProperty("properties").GetProperty("$set").GetProperty("email").GetString());
        Assert.Equal("owner", root.GetProperty("properties").GetProperty("$set").GetProperty("role").GetString());
    }

    private sealed class TestMessageHandler(
        Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> sendAsync) : HttpMessageHandler
    {
        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestCount++;
            return sendAsync(request, cancellationToken);
        }
    }
}
