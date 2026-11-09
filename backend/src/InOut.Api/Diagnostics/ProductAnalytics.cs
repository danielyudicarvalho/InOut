using System.Security.Claims;
using System.Threading.Channels;
using InOut.Application.Diagnostics;

namespace InOut.Api.Diagnostics;

/// <summary>A product event waiting to be sent. Carries no amounts, names or free text.</summary>
public sealed record ProductEvent(string DistinctId, string Name);

/// <summary>
/// In-memory buffer between request handling and PostHog delivery, so a slow or
/// unreachable analytics endpoint never adds latency to a financial write.
/// When full, the oldest events are dropped: analytics is best effort.
/// </summary>
public sealed class ProductEventBuffer
{
    private readonly Channel<ProductEvent> _channel = Channel.CreateBounded<ProductEvent>(
        new BoundedChannelOptions(1_000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

    public bool TryEnqueue(ProductEvent productEvent) => _channel.Writer.TryWrite(productEvent);

    public IAsyncEnumerable<ProductEvent> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}

public sealed class ProductEventDispatcher(ProductEventBuffer queue, IPostHogAnalytics analytics)
    : BackgroundService
{
    private static readonly Dictionary<string, object?> Properties = new()
    {
        ["source"] = "api",
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var productEvent in queue.ReadAllAsync(stoppingToken))
            {
                // PostHogAnalytics swallows and logs delivery failures itself.
                await analytics.CaptureAsync(
                    productEvent.DistinctId, productEvent.Name, Properties, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutdown.
        }
    }
}

/// <summary>Queues a product event after an endpoint succeeds.</summary>
public sealed class ProductEventFilter(string eventName, bool createdOnly) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var result = await next(context);

        var status = (result as IStatusCodeHttpResult)?.StatusCode;
        var succeeded = createdOnly
            ? status == StatusCodes.Status201Created
            : status is >= 200 and < 300;
        var subject = context.HttpContext.User.FindFirstValue(ApiContract.Claims.Subject);
        if (succeeded && !string.IsNullOrEmpty(subject))
        {
            context.HttpContext.RequestServices
                .GetRequiredService<ProductEventBuffer>()
                .TryEnqueue(new ProductEvent(subject, eventName));
        }

        return result;
    }
}

public static class ProductAnalyticsExtensions
{
    /// <summary>
    /// Records <paramref name="eventName"/> for the signed-in user when the endpoint
    /// succeeds. With <paramref name="createdOnly"/>, idempotent replays (200) are
    /// ignored and only first writes (201) count.
    /// </summary>
    public static RouteHandlerBuilder TrackProductEvent(
        this RouteHandlerBuilder builder,
        string eventName,
        bool createdOnly = false) =>
        builder.AddEndpointFilter(new ProductEventFilter(eventName, createdOnly));
}
