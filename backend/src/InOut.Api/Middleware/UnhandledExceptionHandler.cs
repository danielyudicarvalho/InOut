using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace InOut.Api.Middleware;

public sealed class UnhandledExceptionHandler(ILogger<UnhandledExceptionHandler> logger) : IExceptionHandler
{
    private static readonly Action<ILogger, string, Exception?> LogFailure =
        LoggerMessage.Define<string>(LogLevel.Error, new EventId(1002, "UnhandledRequestFailure"),
            "Unhandled request failure: {ExceptionType}");

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        // Exception messages and stack traces can contain SQL, tokens or financial descriptions.
        LogFailure(logger, exception.GetType().Name, null);
        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred. Use the correlation ID to report it."
            },
            cancellationToken);
        return true;
    }
}
