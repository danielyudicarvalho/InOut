using System.Collections.Frozen;
using System.Reflection;
using System.Security.Claims;
using System.Threading.Channels;
using InOut.Api.Identity;
using InOut.Application.Diagnostics;
using InOut.Application.Identity;
using OpenIddict.Abstractions;

namespace InOut.Api.Diagnostics;

/// <summary>A product event waiting to be sent. Carries no amounts, names or free text.</summary>
public sealed record ProductEvent(
    string DistinctId,
    string Name,
    IReadOnlyDictionary<string, object?> Properties);

/// <summary>
/// Builds product events according to the Event Taxonomy: common properties,
/// household grouping and a property allowlist. Anything not on the allowlist is
/// dropped, so a new property must be added here deliberately.
/// </summary>
public static class ProductEvents
{
    public const int SchemaVersion = 1;
    public const string HouseholdGroup = "household";

    /// <summary>Properties an event may carry. Categorical and non-identifying only.</summary>
    public static readonly FrozenSet<string> AllowedProperties = new[]
    {
        "account_kind",
        "changed",
        "currency",
        "flow",
        "has_category",
        "has_description",
        "has_income_source",
        "has_opening_balance",
        "horizon_months",
        "is_subcategory",
    }.ToFrozenSet(StringComparer.Ordinal);

    public static string AppVersion { get; } = ResolveAppVersion();

    public static ProductEvent Create(
        string distinctId,
        string name,
        string? client,
        Guid? householdId = null,
        IReadOnlyDictionary<string, object?>? properties = null)
    {
        var all = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["source"] = "api",
            ["schema_version"] = SchemaVersion,
            ["app_version"] = AppVersion,
            ["client"] = client ?? "unknown",
        };

        if (householdId is { } household)
        {
            var key = household.ToString();
            all["household_id"] = key;
            all["$groups"] = new Dictionary<string, string> { [HouseholdGroup] = key };
        }

        if (properties is not null)
        {
            foreach (var (property, value) in properties)
            {
                if (AllowedProperties.Contains(property))
                {
                    all[property] = value;
                }
            }
        }

        return new ProductEvent(distinctId, name, all);
    }

    /// <summary>Updates the household group's properties in PostHog.</summary>
    public static ProductEvent HouseholdMembers(string distinctId, Guid householdId, int memberCount) =>
        new(distinctId, "$groupidentify", new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["$group_type"] = HouseholdGroup,
            ["$group_key"] = householdId.ToString(),
            ["$group_set"] = new Dictionary<string, object?> { ["member_count"] = memberCount },
        });

    /// <summary>Queues an event built outside an endpoint filter (identity flows).</summary>
    public static void Enqueue(HttpContext http, ProductEvent productEvent) =>
        http.RequestServices.GetRequiredService<ProductEventBuffer>().TryEnqueue(productEvent);

    /// <summary>Records <c>account_confirmed</c> when an e-mail confirmation succeeds.</summary>
    public static void AccountConfirmed(HttpContext http, IdentityCommandResult result, string client)
    {
        if (result.Succeeded && result.User is { } user)
        {
            Enqueue(http, Create(user.Id.ToString(), "account_confirmed", client));
        }
    }

    /// <summary>"web", "mobile" or "unknown", from the OAuth client the access token was issued to.</summary>
    public static string ClientFrom(ClaimsPrincipal user)
    {
        var clientId = user.FindFirstValue(OpenIddictConstants.Claims.ClientId)
            ?? user.FindFirstValue(OpenIddictConstants.Claims.AuthorizedParty)
            ?? user.GetPresenters().FirstOrDefault();
        return ClientFrom(clientId);
    }

    public static string ClientFrom(string? clientId) => clientId switch
    {
        IdentityHosting.WebClientId => "web",
        IdentityHosting.MobileClientId => "mobile",
        _ => "unknown",
    };

    private static string ResolveAppVersion()
    {
        var version = typeof(ProductEvents).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? "0.0.0";
        var metadata = version.IndexOf('+', StringComparison.Ordinal);
        return metadata < 0 ? version : version[..metadata];
    }
}

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

public sealed class ProductEventDispatcher(ProductEventBuffer buffer, IPostHogAnalytics analytics)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var productEvent in buffer.ReadAllAsync(stoppingToken))
            {
                // PostHogAnalytics swallows and logs delivery failures itself.
                await analytics.CaptureAsync(
                    productEvent.DistinctId, productEvent.Name, productEvent.Properties, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutdown.
        }
    }
}

/// <summary>How an endpoint's successful result becomes a product event.</summary>
public sealed class ProductEventOptions
{
    /// <summary>Count only 201 Created, so idempotent replays (200) are ignored.</summary>
    public bool CreatedOnly { get; init; }

    /// <summary>Event properties derived from the endpoint's arguments (the request body).</summary>
    public Func<EndpointFilterInvocationContext, IReadOnlyDictionary<string, object?>?>? Properties { get; init; }

    /// <summary>Household id when it is not the <c>householdId</c> route value (e.g. a created household).</summary>
    public Func<object?, Guid?>? HouseholdFromResult { get; init; }

    /// <summary>When set, also updates the household group's <c>member_count</c>.</summary>
    public int? MemberCountAfter { get; init; }

    /// <summary>Properties from the first argument of type <typeparamref name="TRequest"/>.</summary>
    public static Func<EndpointFilterInvocationContext, IReadOnlyDictionary<string, object?>?> FromRequest<TRequest>(
        Func<TRequest, IReadOnlyDictionary<string, object?>> properties) =>
        context => context.Arguments.OfType<TRequest>().Select(properties).FirstOrDefault();
}

/// <summary>Queues a product event after an endpoint succeeds.</summary>
public sealed class ProductEventFilter(string eventName, ProductEventOptions options) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var result = await next(context);

        // Results without an explicit status (e.g. a file download) are written as 200.
        var status = (result as IStatusCodeHttpResult)?.StatusCode
            ?? (result is IResult ? StatusCodes.Status200OK : null);
        var succeeded = options.CreatedOnly
            ? status == StatusCodes.Status201Created
            : status is >= 200 and < 300;
        var http = context.HttpContext;
        var subject = http.User.FindFirstValue(ApiContract.Claims.Subject);
        if (!succeeded || string.IsNullOrEmpty(subject))
        {
            return result;
        }

        var householdId = options.HouseholdFromResult is { } fromResult
            ? fromResult((result as IValueHttpResult)?.Value)
            : RouteHousehold(http);
        var buffer = http.RequestServices.GetRequiredService<ProductEventBuffer>();
        buffer.TryEnqueue(ProductEvents.Create(
            subject,
            eventName,
            ProductEvents.ClientFrom(http.User),
            householdId,
            options.Properties?.Invoke(context)));

        if (options.MemberCountAfter is { } members && householdId is { } household)
        {
            buffer.TryEnqueue(ProductEvents.HouseholdMembers(subject, household, members));
        }

        return result;
    }

    private static Guid? RouteHousehold(HttpContext http) =>
        Guid.TryParse(http.GetRouteValue("householdId")?.ToString(), out var id) ? id : null;
}

public static class ProductAnalyticsExtensions
{
    /// <summary>Records <paramref name="eventName"/> for the signed-in user when the endpoint succeeds.</summary>
    public static RouteHandlerBuilder TrackProductEvent(
        this RouteHandlerBuilder builder,
        string eventName,
        ProductEventOptions? options = null) =>
        builder.AddEndpointFilter(new ProductEventFilter(eventName, options ?? new ProductEventOptions()));

    /// <summary>Records a ledger write: first commits (201) only, with properties from the request body.</summary>
    public static RouteHandlerBuilder TrackLedgerWrite<TRequest>(
        this RouteHandlerBuilder builder,
        string eventName,
        Func<TRequest, IReadOnlyDictionary<string, object?>> properties) =>
        builder.TrackProductEvent(eventName, new ProductEventOptions
        {
            CreatedOnly = true,
            Properties = ProductEventOptions.FromRequest(properties),
        });
}
