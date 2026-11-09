using System.Security.Claims;
using InOut.Api.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace InOut.Api.Tests;

public sealed class ProductEventFilterTests
{
    private const string UserId = "4b2f6a3e-1c55-4d8e-9a0b-6f1d2e3c4b5a";

    [Fact]
    public async Task SuccessfulWriteQueuesEventForSignedInUser()
    {
        var (context, queue) = Context(signedIn: true);

        await new ProductEventFilter("household_created", createdOnly: false)
            .InvokeAsync(context, _ => ValueTask.FromResult<object?>(Results.Created("/x", null)));

        Assert.Equal(
            [new ProductEvent(UserId, "household_created")],
            await Drain(queue));
    }

    [Fact]
    public async Task CreatedOnlyIgnoresIdempotentReplay()
    {
        var (context, queue) = Context(signedIn: true);

        await new ProductEventFilter("expense_recorded", createdOnly: true)
            .InvokeAsync(context, _ => ValueTask.FromResult<object?>(Results.Ok()));

        Assert.Empty(await Drain(queue));
    }

    [Fact]
    public async Task FailedOrAnonymousRequestsQueueNothing()
    {
        var (failed, failedQueue) = Context(signedIn: true);
        await new ProductEventFilter("expense_recorded", createdOnly: false)
            .InvokeAsync(failed, _ => ValueTask.FromResult<object?>(Results.Conflict()));

        var (anonymous, anonymousQueue) = Context(signedIn: false);
        await new ProductEventFilter("expense_recorded", createdOnly: false)
            .InvokeAsync(anonymous, _ => ValueTask.FromResult<object?>(Results.Ok()));

        Assert.Empty(await Drain(failedQueue));
        Assert.Empty(await Drain(anonymousQueue));
    }

    [Fact]
    public async Task ResultIsReturnedUnchanged()
    {
        var (context, _) = Context(signedIn: true);
        var expected = Results.Created("/x", null);

        var actual = await new ProductEventFilter("household_created", createdOnly: false)
            .InvokeAsync(context, _ => ValueTask.FromResult<object?>(expected));

        Assert.Same(expected, actual);
    }

    private static (EndpointFilterInvocationContext Context, ProductEventBuffer Queue) Context(bool signedIn)
    {
        var queue = new ProductEventBuffer();
        var services = new ServiceCollection().AddSingleton(queue).BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services };
        if (signedIn)
        {
            http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", UserId)], "test"));
        }

        return (new DefaultEndpointFilterInvocationContext(http), queue);
    }

    private static async Task<List<ProductEvent>> Drain(ProductEventBuffer queue)
    {
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        var events = new List<ProductEvent>();
        try
        {
            await foreach (var productEvent in queue.ReadAllAsync(cancellation.Token))
            {
                events.Add(productEvent);
            }
        }
        catch (OperationCanceledException)
        {
        }

        return events;
    }
}
