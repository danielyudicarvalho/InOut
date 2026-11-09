using System.Net;
using System.Net.Http.Json;
using InOut.Application.Diagnostics;
using Microsoft.Extensions.Logging;

namespace InOut.Infrastructure.Diagnostics;

public sealed class PostHogAnalytics : IPostHogAnalytics
{
    private static readonly Action<ILogger, HttpStatusCode, Exception?> LogHttpFailure =
        LoggerMessage.Define<HttpStatusCode>(
            LogLevel.Debug,
            new EventId(1201, "PostHogHttpFailure"),
            "PostHog event capture returned HTTP {StatusCode}");

    private static readonly Action<ILogger, string, Exception?> LogCaptureFailure =
        LoggerMessage.Define<string>(
            LogLevel.Debug,
            new EventId(1202, "PostHogCaptureFailure"),
            "Failed to capture PostHog event {EventName}");

    private readonly HttpClient _httpClient;
    private readonly string? _apiKey;
    private readonly Uri? _captureEndpoint;
    private readonly ILogger<PostHogAnalytics>? _logger;

    public PostHogAnalytics(
        HttpClient httpClient,
        string? apiKey,
        string host,
        ILogger<PostHogAnalytics>? logger = null)
    {
        _httpClient = httpClient;
        _apiKey = string.IsNullOrWhiteSpace(apiKey) ? null : apiKey.Trim();
        _logger = logger;

        if (!string.IsNullOrWhiteSpace(_apiKey))
        {
            var baseHost = string.IsNullOrWhiteSpace(host) ? "https://us.i.posthog.com" : host.TrimEnd('/');
            _captureEndpoint = new Uri($"{baseHost}/capture/");
        }
    }

    public async Task CaptureAsync(
        string distinctId,
        string eventName,
        IReadOnlyDictionary<string, object?>? properties = null,
        CancellationToken cancellationToken = default)
    {
        if (_apiKey is null || _captureEndpoint is null)
        {
            return;
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(distinctId);
        ArgumentException.ThrowIfNullOrWhiteSpace(eventName);

        var payload = new Dictionary<string, object?>
        {
            ["api_key"] = _apiKey,
            ["event"] = eventName,
            ["distinct_id"] = distinctId,
            ["timestamp"] = DateTimeOffset.UtcNow.ToString("O")
        };

        if (properties is { Count: > 0 })
        {
            payload["properties"] = properties;
        }

        try
        {
            using var response = await _httpClient.PostAsJsonAsync(_captureEndpoint, payload, cancellationToken);
            if (!response.IsSuccessStatusCode && _logger is not null)
            {
                LogHttpFailure(_logger, response.StatusCode, null);
            }
        }
        catch (Exception ex)
        {
            if (_logger is not null)
            {
                LogCaptureFailure(_logger, eventName, ex);
            }
        }
    }

    public Task IdentifyAsync(
        string distinctId,
        IReadOnlyDictionary<string, object?>? properties = null,
        CancellationToken cancellationToken = default)
    {
        if (_apiKey is null || _captureEndpoint is null)
        {
            return Task.CompletedTask;
        }

        var identifyProps = new Dictionary<string, object?>
        {
            ["$set"] = properties ?? new Dictionary<string, object?>()
        };

        return CaptureAsync(distinctId, "$identify", identifyProps, cancellationToken);
    }
}
