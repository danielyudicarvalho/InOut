using System.Text;
using InOut.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Xunit;

namespace InOut.Api.Tests;

public sealed class OperationalLoggingTests
{
    [Fact]
    public async Task CompletionHasCorrelationAndResultWithoutRequestData()
    {
        var logger = new RecordingLogger<CorrelationIdMiddleware>();
        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/private/secret-description";
        context.Request.Headers.Authorization = "Bearer secret-token";
        context.Request.Headers[CorrelationIdMiddleware.HeaderName] = "test-123";

        var middleware = new CorrelationIdMiddleware(request =>
        {
            request.Response.StatusCode = 403;
            return Task.CompletedTask;
        }, logger);

        await middleware.InvokeAsync(context);

        Assert.Equal("test-123", context.Response.Headers[CorrelationIdMiddleware.HeaderName]);
        Assert.Contains("403", logger.Messages.Single());
        Assert.DoesNotContain("secret-description", logger.Messages.Single());
        Assert.DoesNotContain("secret-token", logger.Messages.Single());
    }

    [Fact]
    public async Task UnexpectedFailureReportsGenericProblemAndSafeType()
    {
        var logger = new RecordingLogger<UnhandledExceptionHandler>();
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var handler = new UnhandledExceptionHandler(logger);

        var handled = await handler.TryHandleAsync(context,
            new InvalidOperationException("SQL password=private; description=salary"), CancellationToken.None);

        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body, Encoding.UTF8).ReadToEndAsync();
        Assert.True(handled);
        Assert.Equal(500, context.Response.StatusCode);
        Assert.DoesNotContain("private", body + logger.Messages.Single());
        Assert.DoesNotContain("salary", body + logger.Messages.Single());
        Assert.Contains("InvalidOperationException", logger.Messages.Single());
    }

    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
            Exception? exception, Func<TState, Exception?, string> formatter) =>
            Messages.Add(formatter(state, exception));
    }
}
