using InOut.Api.Middleware;
using InOut.Domain.Financial;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace InOut.Api.Tests;

public sealed class TransactionConflictResponseTests
{
    [Fact]
    public async Task StaleDomainFailureReturnsTheSpecificConflictProblemCode()
    {
        using var services = new ServiceCollection().AddLogging().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        using var output = new MemoryStream();
        context.Response.Body = output;
        var handled = await new FinancialExceptionHandler().TryHandleAsync(context,
            new FinancialRuleException(FinancialErrorCodes.TransactionChanged, "Reload current data."), CancellationToken.None);
        Assert.True(handled);
        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        output.Position = 0;
        using var reader = new StreamReader(output);
        Assert.Contains("transaction_changed", await reader.ReadToEndAsync());
    }
}
