using System.Diagnostics;

namespace InOut.Api.Middleware;

public sealed class CorrelationIdMiddleware(
    RequestDelegate next,
    ILogger<CorrelationIdMiddleware> logger)
{
    public const string HeaderName = "X-Correlation-ID";
    private const int MaximumLength = 128;

    private static readonly Func<ILogger, string, IDisposable?> BeginCorrelationScope =
        LoggerMessage.DefineScope<string>("CorrelationId: {CorrelationId}");
    private static readonly Action<ILogger, string, string, int, double, Exception?> LogCompletion =
        LoggerMessage.Define<string, string, int, double>(LogLevel.Information,
            new EventId(1001, "HttpRequestCompleted"),
            "HTTP request completed: {Method} {Endpoint} {StatusCode} in {ElapsedMs} ms");

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = ResolveCorrelationId(context);
        context.Response.Headers[HeaderName] = correlationId;

        using var scope = BeginCorrelationScope(logger, correlationId);
        var started = Stopwatch.GetTimestamp();
        await next(context);
        LogCompletion(logger,
            context.Request.Method,
            context.GetEndpoint()?.DisplayName ?? "unmatched",
            context.Response.StatusCode,
            Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            null);
    }

    private static string ResolveCorrelationId(HttpContext context)
    {
        var candidate = context.Request.Headers[HeaderName].FirstOrDefault();

        if (IsValid(candidate))
        {
            return candidate!;
        }

        return Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("N");
    }

    private static bool IsValid(string? value) =>
        !string.IsNullOrWhiteSpace(value) &&
        value.Length <= MaximumLength &&
        value.All(character =>
            char.IsAsciiLetterOrDigit(character) ||
            character is '-' or '_' or '.');
}
