using System.Security.Claims;
using InOut.Api.Diagnostics;
using InOut.Domain.Households;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;
using Xunit;

namespace InOut.Api.Tests;

public sealed class ProductEventTests
{
    private const string UserId = "4b2f6a3e-1c55-4d8e-9a0b-6f1d2e3c4b5a";
    private static readonly Guid HouseholdId = Guid.Parse("9f8e7d6c-5b4a-4321-8fed-cba987654321");

    [Fact]
    public async Task SuccessfulWriteQueuesEventWithCommonPropertiesAndHouseholdGroup()
    {
        var (context, buffer) = Context(signedIn: true, clientId: "inout-mobile");

        await Filter("expense_recorded").InvokeAsync(context, _ => Ok(Results.Created("/x", null)));

        var queued = Assert.Single(await Drain(buffer));
        Assert.Equal(UserId, queued.DistinctId);
        Assert.Equal("expense_recorded", queued.Name);
        Assert.Equal("api", queued.Properties["source"]);
        Assert.Equal(ProductEvents.SchemaVersion, queued.Properties["schema_version"]);
        Assert.Equal("mobile", queued.Properties["client"]);
        Assert.False(string.IsNullOrEmpty(queued.Properties["app_version"] as string));
        Assert.Equal(HouseholdId.ToString(), queued.Properties["household_id"]);
        var groups = Assert.IsType<Dictionary<string, string>>(queued.Properties["$groups"]);
        Assert.Equal(HouseholdId.ToString(), groups["household"]);
    }

    [Fact]
    public async Task CreatedOnlyIgnoresIdempotentReplay()
    {
        var (context, buffer) = Context(signedIn: true);

        await Filter("expense_recorded", new ProductEventOptions { CreatedOnly = true })
            .InvokeAsync(context, _ => Ok(Results.Ok()));

        Assert.Empty(await Drain(buffer));
    }

    [Fact]
    public async Task FailedOrAnonymousRequestsQueueNothing()
    {
        var (failed, failedBuffer) = Context(signedIn: true);
        await Filter("expense_recorded").InvokeAsync(failed, _ => Ok(Results.Conflict()));

        var (anonymous, anonymousBuffer) = Context(signedIn: false);
        await Filter("expense_recorded").InvokeAsync(anonymous, _ => Ok(Results.Ok()));

        Assert.Empty(await Drain(failedBuffer));
        Assert.Empty(await Drain(anonymousBuffer));
    }

    [Fact]
    public async Task FileDownloadCountsAsSuccess()
    {
        var (context, buffer) = Context(signedIn: true);

        await Filter("ledger_exported").InvokeAsync(context, _ => Ok(Results.File([1, 2, 3], "text/csv")));

        Assert.Equal("ledger_exported", Assert.Single(await Drain(buffer)).Name);
    }

    [Fact]
    public async Task ResultIsReturnedUnchanged()
    {
        var (context, _) = Context(signedIn: true);
        var expected = Results.Created("/x", null);

        var actual = await Filter("household_created").InvokeAsync(context, _ => Ok(expected));

        Assert.Same(expected, actual);
    }

    [Fact]
    public async Task RequestPropertiesAreExtractedAndUnlistedOnesDropped()
    {
        var (context, buffer) = Context(signedIn: true, arguments: new SampleRequest("Lunch", 12_345));
        var options = new ProductEventOptions
        {
            Properties = ProductEventOptions.FromRequest((SampleRequest r) => new Dictionary<string, object?>
            {
                ["has_description"] = r.Description is not null,
                ["amount_cents"] = r.AmountCents,
                ["description"] = r.Description,
            }),
        };

        await Filter("expense_recorded", options).InvokeAsync(context, _ => Ok(Results.Created("/x", null)));

        var queued = Assert.Single(await Drain(buffer));
        Assert.Equal(true, queued.Properties["has_description"]);
        Assert.False(queued.Properties.ContainsKey("amount_cents"));
        Assert.False(queued.Properties.ContainsKey("description"));
        Assert.DoesNotContain(queued.Properties.Values, value => Equals(value, "Lunch") || Equals(value, 12_345L));
    }

    [Fact]
    public async Task HouseholdFromResultAlsoUpdatesMemberCount()
    {
        var created = Guid.NewGuid();
        var (context, buffer) = Context(signedIn: true, routeHousehold: false);
        var options = new ProductEventOptions
        {
            HouseholdFromResult = value => (value as Household)?.Id,
            MemberCountAfter = 1,
        };

        await Filter("household_created", options)
            .InvokeAsync(context, _ => Ok(Results.Created("/x", new Household(created, "Casa"))));

        var events = await Drain(buffer);
        Assert.Equal(2, events.Count);
        Assert.Equal(created.ToString(), events[0].Properties["household_id"]);
        Assert.DoesNotContain(events[0].Properties.Values, value => Equals(value, "Casa"));
        Assert.Equal("$groupidentify", events[1].Name);
        Assert.Equal("household", events[1].Properties["$group_type"]);
        Assert.Equal(created.ToString(), events[1].Properties["$group_key"]);
        var set = Assert.IsType<Dictionary<string, object?>>(events[1].Properties["$group_set"]);
        Assert.Equal(1, set["member_count"]);
    }

    [Fact]
    public void AllowlistHasNoSensitiveProperty()
    {
        string[] forbidden = ["amount", "balance", "limit", "target", "name", "email", "code", "token", "note"];
        // has_/is_ properties are booleans: "has_opening_balance" says whether, never how much.
        foreach (var property in ProductEvents.AllowedProperties.Where(p => !p.StartsWith("has_", StringComparison.Ordinal) && !p.StartsWith("is_", StringComparison.Ordinal)))
        {
            var words = property.Split('_');
            Assert.DoesNotContain(words, word => forbidden.Contains(word));
            Assert.False(property == "description", "Free-text descriptions must never be sent.");
        }
    }

    [Theory]
    [InlineData("inout-web", "web")]
    [InlineData("inout-mobile", "mobile")]
    [InlineData("something-else", "unknown")]
    [InlineData(null, "unknown")]
    public void ClientIsDerivedFromTheTokenClient(string? clientId, string expected)
    {
        Assert.Equal(expected, ProductEvents.ClientFrom(clientId));
        var claims = clientId is null ? [] : new[] { new Claim(OpenIddictConstants.Claims.ClientId, clientId) };
        Assert.Equal(expected, ProductEvents.ClientFrom(new ClaimsPrincipal(new ClaimsIdentity(claims, "test"))));
    }

    private static ProductEventFilter Filter(string name, ProductEventOptions? options = null) =>
        new(name, options ?? new ProductEventOptions());

    private static ValueTask<object?> Ok(IResult result) => ValueTask.FromResult<object?>(result);

    private static (EndpointFilterInvocationContext Context, ProductEventBuffer Buffer) Context(
        bool signedIn,
        string? clientId = "inout-web",
        object? arguments = null,
        bool routeHousehold = true)
    {
        var buffer = new ProductEventBuffer();
        var services = new ServiceCollection().AddSingleton(buffer).BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services };
        if (routeHousehold)
        {
            http.Request.RouteValues = new RouteValueDictionary { ["householdId"] = HouseholdId.ToString() };
        }

        if (signedIn)
        {
            List<Claim> claims = [new("sub", UserId)];
            if (clientId is not null)
            {
                claims.Add(new Claim(OpenIddictConstants.Claims.ClientId, clientId));
            }

            http.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        }

        return (arguments is null
            ? new DefaultEndpointFilterInvocationContext(http)
            : new DefaultEndpointFilterInvocationContext(http, arguments), buffer);
    }

    private static async Task<List<ProductEvent>> Drain(ProductEventBuffer buffer)
    {
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        var events = new List<ProductEvent>();
        try
        {
            await foreach (var productEvent in buffer.ReadAllAsync(cancellation.Token))
            {
                events.Add(productEvent);
            }
        }
        catch (OperationCanceledException)
        {
        }

        return events;
    }

    private sealed record SampleRequest(string? Description, long AmountCents);
}
